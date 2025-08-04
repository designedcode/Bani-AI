// Basic test for BaniDB service
import { banidbService } from '../banidbService';

// Mock fetch for testing
global.fetch = jest.fn();

describe('BaniDBService', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('should fetch full shabad successfully', async () => {
    const mockResponse = {
      shabadInfo: {
        shabadId: 123,
        shabadName: 'Test Shabad',
        pageNo: 1,
        source: { unicode: 'Test Source' },
        raag: { unicode: 'Test Raag' },
        writer: { english: 'Test Writer' }
      },
      count: 5,
      navigation: { next: 124, previous: 122 },
      verses: [
        {
          verse: { unicode: 'ਤੇਸਟ ਲਾਈਨ' },
          transliteration: { english: 'test line' },
          translation: { en: { bdb: 'Test translation' } },
          verseId: 1,
          pageNo: 1,
          lineNo: 1
        }
      ]
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await banidbService.getFullShabad(123);

    expect(fetch).toHaveBeenCalledWith('https://api.banidb.com/v2/shabads/123');
    expect(result.shabad_id).toBe(123);
    expect(result.lines_highlighted).toHaveLength(1);
    expect(result.lines_highlighted[0].gurmukhi_highlighted).toBe('ਤੇਸਟ ਲਾਈਨ');
  });

  it('should fallback to verse endpoint when shabad not found', async () => {
    const mockVerseResponse = {
      shabadInfo: {
        shabadId: 123,
        shabadName: 'Test Shabad from Verse'
      },
      verses: []
    };

    (fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('HTTP error! status: 404'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockVerseResponse
      });

    const result = await banidbService.getFullShabad(123, 456);

    expect(fetch).toHaveBeenCalledWith('https://api.banidb.com/v2/shabads/123');
    expect(fetch).toHaveBeenCalledWith('https://api.banidb.com/v2/verse/456');
    expect(result.shabad_id).toBe(123);
  });
});