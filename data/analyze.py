import os
import sys
import pandas as pd

def check_files():
    """Verify that train and test CSV files exist in the data/ directory."""
    data_dir = os.path.dirname(os.path.abspath(__file__))
    train_path = os.path.join(data_dir, "UNSW_NB15_training-set.csv")
    test_path = os.path.join(data_dir, "UNSW_NB15_testing-set.csv")
    
    files_exist = True
    if not os.path.exists(train_path):
        print(f"[BLOCKER] Training set file not found at: {train_path}")
        files_exist = False
    if not os.path.exists(test_path):
        print(f"[BLOCKER] Testing set file not found at: {test_path}")
        files_exist = False
        
    if not files_exist:
        print("\nPlease download the official UNSW-NB15 dataset files from:")
        print("https://research.unsw.edu.au/projects/unsw-nb15-dataset")
        print("And place them in the 'data/' directory as:")
        print(" - UNSW_NB15_training-set.csv")
        print(" - UNSW_NB15_testing-set.csv")
        return None, None
        
    return train_path, test_path

def analyze_dataset(train_path, test_path):
    """Perform reproducible data analysis on the train/test sets."""
    print("==================================================")
    print("      UNSW-NB15 DATASET REPRODUCIBLE ANALYSIS     ")
    print("==================================================")
    
    print("\n1. Loading datasets...")
    train_df = pd.read_csv(train_path)
    test_df = pd.read_csv(test_path)
    
    print(f"Training set loaded: {train_df.shape[0]} rows, {train_df.shape[1]} columns")
    print(f"Testing set loaded: {test_df.shape[0]} rows, {test_df.shape[1]} columns")
    
    print("\n2. Column Schema Alignment:")
    train_cols = set(train_df.columns)
    test_cols = set(test_df.columns)
    
    if train_cols == test_cols:
        print(" - OK: Sütun isimleri birebir eşleşiyor.")
    else:
        print(" - UYARI: Sütun isimleri eşleşmiyor!")
        print(f"   Train setinde olup Test setinde olmayan: {train_cols - test_cols}")
        print(f"   Test setinde olup Train setinde olmayan: {test_cols - train_cols}")
        
    if list(train_df.columns) == list(test_df.columns):
        print(" - OK: Sütun sıralamaları birebir aynı.")
    else:
        print(" - UYARI: Sütun sıralamaları farklı!")
        
    print("\n3. Target Column ('label') Class Distribution:")
    for name, df in [("Train", train_df), ("Test", test_df)]:
        print(f"\n--- {name} Set Label Distribution ---")
        if 'label' in df.columns:
            counts = df['label'].value_counts()
            pcts = df['label'].value_counts(normalize=True) * 100
            for val in sorted(counts.index):
                label_name = "Normal (0)" if val == 0 else "Saldırı (1)"
                print(f"  {label_name}: {counts[val]} adet ({pcts[val]:.2f}%)")
        else:
            print("  HATA: 'label' sütunu bulunamadı!")
            
    print("\n4. Attack Category ('attack_cat') Distribution:")
    for name, df in [("Train", train_df), ("Test", test_df)]:
        print(f"\n--- {name} Set Attack Categories ---")
        if 'attack_cat' in df.columns:
            # Filling NaNs as Normal if empty
            cat_series = df['attack_cat'].fillna('Normal').str.strip()
            counts = cat_series.value_counts()
            pcts = cat_series.value_counts(normalize=True) * 100
            for idx, (cat, val) in enumerate(counts.items()):
                print(f"  {idx+1:2d}. {cat:18s}: {val:6d} adet ({pcts[cat]:.2f}%)")
        else:
            print("  HATA: 'attack_cat' sütunu bulunamadı!")
            
    print("\n5. Missing Value Analysis:")
    for name, df in [("Train", train_df), ("Test", test_df)]:
        null_counts = df.isnull().sum()
        cols_with_nulls = null_counts[null_counts > 0]
        print(f"  {name} set contains {len(cols_with_nulls)} columns with null values.")
        for col, count in cols_with_nulls.items():
            print(f"    - {col}: {count} null value(s)")
            
        # Check for special characters like '-' or ' ' that represent missing values
        for col in df.select_dtypes(include=['object']).columns:
            for char in ['-', ' ']:
                char_count = (df[col] == char).sum()
                if char_count > 0:
                    print(f"    - {col}: Contains {char_count} record(s) with placeholder '{char}'")
                    
    print("\n6. Duplicate Record Analysis:")
    for name, df in [("Train", train_df), ("Test", test_df)]:
        # Exclude 'id' column if it exists, as it is a unique index and prevents duplicate detection
        if 'id' in df.columns:
            features_df = df.drop(columns=['id'])
        else:
            features_df = df
        duplicates = features_df.duplicated().sum()
        print(f"  {name} set contains {duplicates} duplicate records (excluding 'id' column).")

    print("\n7. Categorical Values Alignment:")
    categorical_cols = train_df.select_dtypes(include=['object']).columns
    for col in categorical_cols:
        if col == 'attack_cat':
            continue
        train_vals = set(train_df[col].dropna().unique())
        test_vals = set(test_df[col].dropna().unique())
        
        mismatches_test = test_vals - train_vals
        if mismatches_test:
            print(f"  UYARI: '{col}' sütununda, test setinde olup train setinde olmayan değerler var:")
            print(f"    {mismatches_test}")
        else:
            print(f"  OK: '{col}' kategorik sütun değerleri uyumlu.")

if __name__ == "__main__":
    train_file, test_file = check_files()
    if train_file and test_file:
        analyze_dataset(train_file, test_file)
    else:
        sys.exit(1)
