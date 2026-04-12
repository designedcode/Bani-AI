import { transcriptionService } from '../transcriptionService';

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

describe('TranscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty results when no SGGS match (no reload in service)', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcribed_text: 'test text',
        confidence: 0.8,
        sggs_match_found: false,
        shabad_id: 0,
        best_sggs_match: '',
        best_sggs_score: null,
        timestamp: Date.now()
      })
    } as Response);

    const result = await transcriptionService.transcribeAndSearch('test text', 0.8);

    expect(result.results).toHaveLength(0);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('returns empty results when SGGS match but no shabad_id', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcribed_text: 'test text',
        confidence: 0.8,
        sggs_match_found: true,
        shabad_id: 0,
        best_sggs_match: 'some match',
        best_sggs_score: 80,
        timestamp: Date.now()
      })
    } as Response);

    const result = await transcriptionService.transcribeAndSearch('test text', 0.8);

    expect(result.results).toHaveLength(0);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('returns results when SGGS match and shabad_id present', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transcribed_text: 'test text',
        confidence: 0.8,
        sggs_match_found: true,
        shabad_id: 42,
        best_sggs_match: 'some match',
        best_sggs_score: 80,
        timestamp: Date.now()
      })
    } as Response);

    const result = await transcriptionService.transcribeAndSearch('test text', 0.8);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].shabad_id).toBe(42);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('throws on HTTP error (caller may refresh)', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    } as Response);

    await expect(
      transcriptionService.transcribeAndSearch('test text', 0.8)
    ).rejects.toThrow('HTTP error! status: 500');

    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
