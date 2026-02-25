 
from typing import Optional, Dict, Any, List


class ShabadTracker:
    """
    Stateful tracker that confirms and maintains correct Shabad alignment
    during streaming transcription.

    Hybrid validation:
    - Global search (all shabads)
    - Local search (current shabad only)
    """

    def __init__(self, global_search_function, local_search_function):
        """
        global_search_function(query: str) -> Dict
            Searches across ALL shabads

        local_search_function(shabad_id: str, query: str) -> Dict
            Searches ONLY inside a specific shabad
        """

        self.global_search = global_search_function
        self.local_search = local_search_function

        self.current_shabad_id: Optional[str] = None
        self.confirmed: bool = False
        self.failure_counter: int = 0

        self.word_buffer: List[str] = []

        # Tunable parameters
        self.MAX_FAILURES = 3
        self.INTERIM_WORD_CHECK = 8
        self.LOCAL_THRESHOLD = 60
        self.GLOBAL_THRESHOLD = 65

    # INITIAL CONFIRMATION (GLOBAL)

    def initial_confirm(self, transcription_chunk: str) -> Dict[str, Any]:

        result = self.global_search(transcription_chunk)

        if not result:
            return {"status": "no_match"}

        candidate_shabad = result["shabad_id"]

        # Confirm consistency with next global check
        second_result = self.global_search(transcription_chunk)

        if second_result and second_result["shabad_id"] == candidate_shabad:
            self.current_shabad_id = candidate_shabad
            self.confirmed = True
            self.failure_counter = 0

            return {
                "status": "confirmed",
                "shabad_id": candidate_shabad,
                "line": result["line"],
                "score": result["score"],
            }

        return {"status": "pending_confirmation"}

    # HYBRID VALIDATION

    def validate_progression(self) -> bool:
        """
        Validate next 8 words using:
        1. Local search (inside current shabad)
        2. Global search (entire SGGS)
        """

        if len(self.word_buffer) < self.INTERIM_WORD_CHECK:
            return True  # Not enough data yet

        # Take last 8 words (forward progression)
        window = " ".join(self.word_buffer[-self.INTERIM_WORD_CHECK:])

        local_result = self.local_search(self.current_shabad_id, window)
        global_result = self.global_search(window)

        local_score = local_result["score"] if local_result else 0
        global_id = global_result["shabad_id"] if global_result else None
        global_score = global_result["score"] if global_result else 0

        # Case 1: Both agree on same shabad → very strong confirmation
        if local_result and global_result:
            if global_id == self.current_shabad_id and local_score >= self.LOCAL_THRESHOLD:
                return True

        # Case 2: Local strong even if global weak
        if local_score >= self.LOCAL_THRESHOLD:
            return True

        # Case 3: Global stronger but points elsewhere → drift likely
        if global_score >= self.GLOBAL_THRESHOLD and global_id != self.current_shabad_id:
            return False

        return False

    # DRIFT DETECTION

    def detect_drift(self) -> bool:

        valid = self.validate_progression()

        if not valid:
            self.failure_counter += 1
        else:
            self.failure_counter = 0

        if self.failure_counter >= self.MAX_FAILURES:
            self.reset()
            return True

        return False

    # MAIN ENTRY FUNCTION

    def process_chunk(self, transcription_chunk: str) -> Dict[str, Any]:

        words = transcription_chunk.split()
        print(f"[TRACKER] Processing chunk: {transcription_chunk}")
        self.word_buffer.extend(words)

        # Not confirmed yet → global confirm
        if not self.confirmed:
            return self.initial_confirm(transcription_chunk)
        print(f"[TRACKER] Confirmed: {self.confirmed}")

        # Confirmed → validate progression
        drifted = self.detect_drift()

        if drifted:
            return {"status": "drift_detected"}

        return {
            "status": "tracking",
            "shabad_id": self.current_shabad_id,
        }
    
    

    def reset(self):
        self.current_shabad_id = None
        self.confirmed = False
        self.failure_counter = 0
        self.word_buffer = []