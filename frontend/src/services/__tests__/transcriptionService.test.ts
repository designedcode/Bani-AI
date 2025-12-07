import { transcriptionService } from '../transcriptionService';
import { banidbService } from '../banidbService';

// Mock the banidbService
jest.mock('../banidbService');
const mockedBanidbService = banidbService as jest.Mocked<typeof banidbService>;

// Mock fetch
global.fetch = jest.fn();
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock window.location.reload
Object.defineProperty(window, 'location', {
  value: {
    reload: jest.fn()
  },
  writable: true
});

describe('TranscriptionService Page Refresh Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should refresh page when no results are found', async () => {
    jest.useFakeTimers();
    
    // Mock backend response with SGGS match but BaniDB returns no results
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcribed_text: 'test text',
        confidence: 0.8,
        sggs_match_found: true,
        best_sggs_match: 'some match',
        best_sggs_score: 80,
        timestamp: Date.now()
      })
    } as Response);

    // Mock BaniDB service to return no results
    mockedBanidbService.searchFromSGGSLine.mockResolvedValueOnce([]);

    // Attempt transcription
    await expect(
      transcriptionService.transcribeAndSearch('test text', 0.8)
    ).rejects.toThrow('No results found - page will refresh');

    // Fast-forward time to trigger the page refresh
    jest.advanceTimersByTime(1000);

    // Verify page refresh was called
    expect(window.location.reload).toHaveBeenCalledTimes(1);
    
    jest.useRealTimers();
  });

  it('should not refresh page when results are found', async () => {
    // Mock backend response with SGGS match
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcribed_text: 'test text',
        confidence: 0.8,
        sggs_match_found: true,
        best_sggs_match: 'some match',
        best_sggs_score: 80,
        timestamp: Date.now()
      })
    } as Response);

    // Mock BaniDB service to return results
    mockedBanidbService.searchFromSGGSLine.mockResolvedValueOnce([{
      gurmukhi_text: 'ਗੁਰਮੁਖੀ ਟੈਕਸਟ',
      english_translation: 'English translation',
      verse_id: 1,
      shabad_id: 1,
      source: 'SGGS',
      writer: 'Guru Nanak Dev Ji',
      raag: 'Asa'
    }]);

    // Attempt transcription
    const result = await transcriptionService.transcribeAndSearch('test text', 0.8);

    // Verify results were returned and no page refresh was triggered
    expect(result.results).toHaveLength(1);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('should refresh page when no SGGS match is found', async () => {
    jest.useFakeTimers();
    
    // Mock backend response with no SGGS match
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcribed_text: 'test text',
        confidence: 0.8,
        sggs_match_found: false,
        best_sggs_match: null,
        best_sggs_score: null,
        timestamp: Date.now()
      })
    } as Response);

    // No BaniDB service call should be made when no SGGS match

    // Attempt transcription
    await expect(
      transcriptionService.transcribeAndSearch('test text', 0.8)
    ).rejects.toThrow('No results found - page will refresh');

    // Verify BaniDB service was not called
    expect(mockedBanidbService.searchFromSGGSLine).not.toHaveBeenCalled();

    // Fast-forward time to trigger the page refresh
    jest.advanceTimersByTime(1000);

    // Verify page refresh was called
    expect(window.location.reload).toHaveBeenCalledTimes(1);
    
    jest.useRealTimers();
  });
});