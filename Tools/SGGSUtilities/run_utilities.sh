#!/bin/bash

echo "🔧 SGGS Utilities Runner"
echo "========================"

# Check if we're in the right directory
if [ ! -f "optimize_sggs.py" ] || [ ! -f "create_inverted_index.py" ]; then
    echo "❌ Error: Please run this script from the Tools/SGGSUtilities directory"
    exit 1
fi

# Check if SGGSO.txt exists
if [ ! -f "../../backend/uploads/SGGSO.txt" ]; then
    echo "❌ Error: SGGSO.txt not found at ../../backend/uploads/SGGSO.txt"
    echo "Please ensure the SGGSO.txt file exists before running utilities."
    exit 1
fi

echo "Available utilities:"
echo "1. Optimize SGGSO.txt (remove special characters)"
echo "2. Create inverted index"
echo "3. Run both utilities"
echo "4. Exit"
echo

read -p "Select an option (1-4): " choice

case $choice in
    1)
        echo "🚀 Running SGGSO.txt optimization..."
        python3 optimize_sggs.py
        ;;
    2)
        echo "🚀 Creating inverted index..."
        python3 create_inverted_index.py
        ;;
    3)
        echo "🚀 Running both utilities..."
        echo "Step 1: Optimizing SGGSO.txt..."
        python3 optimize_sggs.py
        echo
        echo "Step 2: Creating inverted index..."
        python3 create_inverted_index.py
        ;;
    4)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid option. Please select 1-4."
        exit 1
        ;;
esac

echo
echo "✅ Utilities completed!"