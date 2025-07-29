#!/usr/bin/env python3
"""
One-time script to create an inverted index for SGGSO.txt
Ignores specific Gurmukhi characters and separates tokens by whitespace.
"""

import json
import re
from collections import defaultdict
from pathlib import Path

def create_inverted_index(file_path):
    """
    Create an inverted index from SGGSO.txt file.
    
    Args:
        file_path (str): Path to the SGGSO.txt file
        
    Returns:
        dict: Inverted index mapping words to line numbers
    """
    # Characters to ignore
    ignore_chars = {"॥", "ਰਹਾਉ", "੧", "੨", "੩", "੪", "੫", "੬", "੭", "੮", "੯", "੦", "ੴ"}
    
    # Initialize inverted index
    inverted_index = defaultdict(set)
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            for line_num, line in enumerate(file, 1):
                # Strip whitespace and skip empty lines
                line = line.strip()
                if not line:
                    continue
                
                # Split line into tokens by whitespace
                tokens = line.split()
                
                # Process each token
                for token in tokens:
                    # Remove punctuation and normalize token
                    cleaned_token = token.strip()
                    
                    # Skip if token is in ignore list
                    if cleaned_token in ignore_chars:
                        continue
                    
                    # Skip empty tokens
                    if not cleaned_token:
                        continue
                    
                    # Add to inverted index
                    inverted_index[cleaned_token].add(line_num)
        
        # Convert sets to sorted lists for JSON serialization
        result = {}
        for word, line_numbers in inverted_index.items():
            result[word] = sorted(list(line_numbers))
        
        return result
        
    except FileNotFoundError:
        print(f"Error: File {file_path} not found")
        return {}
    except Exception as e:
        print(f"Error processing file: {e}")
        return {}

def save_index_to_file(index, output_file):
    """Save the inverted index to a JSON file."""
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
        print(f"Inverted index saved to {output_file}")
    except Exception as e:
        print(f"Error saving index: {e}")

def print_statistics(index):
    """Print statistics about the inverted index."""
    total_words = len(index)
    total_occurrences = sum(len(line_nums) for line_nums in index.values())
    
    print(f"\nInverted Index Statistics:")
    print(f"Total unique words: {total_words}")
    print(f"Total word occurrences: {total_occurrences}")
    
    # Show most frequent words
    word_freq = [(word, len(line_nums)) for word, line_nums in index.items()]
    word_freq.sort(key=lambda x: x[1], reverse=True)
    
    print(f"\nTop 10 most frequent words:")
    for word, freq in word_freq[:10]:
        print(f"  {word}: {freq} occurrences")

def main():
    """Main function to create and save the inverted index."""
    # File paths (relative to project root)
    input_file = "../../backend/uploads/SGGSO.txt"
    output_file = "sggso_inverted_index.json"
    
    print(f"Creating inverted index for {input_file}...")
    
    # Check if input file exists
    if not Path(input_file).exists():
        print(f"Error: Input file {input_file} does not exist")
        return
    
    # Create inverted index
    index = create_inverted_index(input_file)
    
    if not index:
        print("Failed to create inverted index")
        return
    
    # Save to file
    save_index_to_file(index, output_file)
    
    # Print statistics
    print_statistics(index)
    
    print(f"\nInverted index creation completed!")
    print(f"Output saved to: {output_file}")

if __name__ == "__main__":
    main()