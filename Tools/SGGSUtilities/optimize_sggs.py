#!/usr/bin/env python3
"""
One-time script to create an optimized version of SGGSO.txt
Removes specified Gurmukhi characters and words for better text processing.
"""

import re
import os

def optimize_sggs_text(input_file, output_file):
    """
    Remove specified Gurmukhi characters and words from SGGSO.txt
    
    Args:
        input_file (str): Path to the original SGGS.txt file
        output_file (str): Path for the optimized output file
    """
    
    # Characters and words to remove
    elements_to_remove = [
        "॥",        # Double danda
        "ਰਹਾਉ",     # Rahao
        "੧",        # Gurmukhi digit 1
        "੨",        # Gurmukhi digit 2
        "੩",        # Gurmukhi digit 3
        "੪",        # Gurmukhi digit 4
        "੫",        # Gurmukhi digit 5
        "੬",        # Gurmukhi digit 6
        "੭",        # Gurmukhi digit 7
        "੮",        # Gurmukhi digit 8
        "੯",        # Gurmukhi digit 9
        "੦",        # Gurmukhi digit 0
        "ਸਲੋਕੁ",    # Salok
        "ੴ"         # Ik Onkar
    ]
    
    try:
        # Read the original file
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        print(f"Original file size: {len(content)} characters")
        
        # Remove each element
        optimized_content = content
        removal_stats = {}
        
        for element in elements_to_remove:
            count_before = optimized_content.count(element)
            optimized_content = optimized_content.replace(element, '')
            removal_stats[element] = count_before
            
        # Clean up extra whitespace that might be left after removals
        # Replace multiple spaces with single space
        optimized_content = re.sub(r' +', ' ', optimized_content)
        
        # Remove empty lines and lines with only whitespace
        lines = optimized_content.split('\n')
        cleaned_lines = []
        for line in lines:
            stripped_line = line.strip()
            if stripped_line:  # Only keep non-empty lines
                cleaned_lines.append(stripped_line)
        
        optimized_content = '\n'.join(cleaned_lines)
        
        # Write the optimized content to output file
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(optimized_content)
        
        print(f"Optimized file size: {len(optimized_content)} characters")
        print(f"Size reduction: {len(content) - len(optimized_content)} characters")
        print(f"Compression ratio: {((len(content) - len(optimized_content)) / len(content) * 100):.2f}%")
        
        print("\nRemoval statistics:")
        for element, count in removal_stats.items():
            if count > 0:
                print(f"  '{element}': {count} occurrences removed")
        
        print(f"\nOptimized file saved as: {output_file}")
        
    except FileNotFoundError:
        print(f"Error: Input file '{input_file}' not found.")
    except Exception as e:
        print(f"Error processing file: {e}")

def main():
    """Main function to run the optimization"""
    
    # File paths (relative to project root)
    input_file = "../../backend/uploads/SGGSO.txt"
    output_file = "../../backend/uploads/SGGSO_optimized.txt"
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found.")
        print("Please ensure the SGGSO.txt file exists in the backend/uploads/ directory.")
        return
    
    print("Starting SGGSO.txt optimization...")
    print(f"Input file: {input_file}")
    print(f"Output file: {output_file}")
    print("-" * 50)
    
    optimize_sggs_text(input_file, output_file)
    
    print("-" * 50)
    print("Optimization complete!")

if __name__ == "__main__":
    main()