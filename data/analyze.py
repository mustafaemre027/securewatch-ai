import os
import sys
import glob
import pandas as pd
import numpy as np

def find_csv_files():
    """Find all CSV files inside the data/raw directory."""
    data_dir = os.path.dirname(os.path.abspath(__file__))
    raw_dir = os.path.join(data_dir, "raw")
    csv_pattern = os.path.join(raw_dir, "*.csv")
    csv_files = glob.glob(csv_pattern)
    return sorted(csv_files)

def analyze_dataset():
    """Perform reproducible data analysis on all CIC-IDS2017 raw CSV files."""
    csv_files = find_csv_files()

    if not csv_files:
        print("[BLOCKER] No CSV files found in the data/raw directory.")
        print("Please place the 8 official CIC-IDS2017 CSV files under 'data/raw/' and run this script again.")
        return

    print("==================================================")
    print("      CIC-IDS2017 DATASET REPRODUCIBLE ANALYSIS   ")
    print("==================================================")
    print(f"Found {len(csv_files)} CSV files in data/raw/\n")

    # Global metrics
    global_multiclass_distribution = {}
    global_binary_distribution = {0: 0, 1: 0}
    global_missing_labels = 0

    failed_files = []
    chunk_size = 100000

    for file_idx, file_path in enumerate(csv_files, 1):
        file_name = os.path.basename(file_path)
        print("--------------------------------------------------")
        print(f"Analyzing File [{file_idx}/{len(csv_files)}]: {file_name}")
        print("--------------------------------------------------")

        # Initialize file-specific metrics
        total_rows = 0
        columns_list = []
        dtypes_dict = {}

        file_multiclass_distribution = {}
        file_binary_distribution = {0: 0, 1: 0}
        file_missing_labels = 0

        total_nans = 0
        total_infs = 0
        seen_hashes = set()
        duplicate_count = 0

        first_chunk = True

        try:
            for chunk in pd.read_csv(file_path, chunksize=chunk_size):
                # 1. Clean column names (strip leading/trailing whitespaces)
                chunk.columns = chunk.columns.str.strip()

                # Capture columns and dtypes from the first chunk
                if first_chunk:
                    columns_list = list(chunk.columns)
                    dtypes_dict = chunk.dtypes.to_dict()
                    first_chunk = False

                total_rows += len(chunk)

                # 2. Count NaNs
                total_nans += chunk.isnull().sum().sum()

                # 3. Count Infinities
                for col in chunk.columns:
                    if pd.api.types.is_numeric_dtype(chunk[col]):
                        total_infs += np.isinf(chunk[col]).sum()
                    else:
                        # For string/object representation of infinity
                        total_infs += chunk[col].astype(str).str.strip().isin(
                            ['inf', 'Infinity', 'infinity', 'INF', '-inf', '-Infinity']
                        ).sum()

                # 4. Duplicate Detection across chunks using row hashing
                hashes = pd.util.hash_pandas_object(chunk, index=False)
                for h in hashes:
                    if h in seen_hashes:
                        duplicate_count += 1
                    else:
                        seen_hashes.add(h)

                # 5. Label Distribution & Normalization
                if 'Label' in chunk.columns:
                    label_series = chunk['Label']

                    # Count missing values in Label
                    missing_count = label_series.isna().sum()
                    file_missing_labels += missing_count
                    global_missing_labels += missing_count

                    # Process non-null label values with uppercase normalization
                    valid_labels = label_series.dropna().astype("string").str.strip().str.upper()

                    # Clean encoding anomalies (\uFFFD, \x96, en dash, em dash) to standard " - "
                    valid_labels = valid_labels.str.replace(
                        r'[\uFFFD\x96–—]+',
                        ' - ',
                        regex=True
                    )
                    # Normalize multiple whitespaces to single space
                    valid_labels = valid_labels.str.replace(r'\s+', ' ', regex=True).str.strip()

                    for val, count in valid_labels.value_counts().items():
                        file_multiclass_distribution[val] = file_multiclass_distribution.get(val, 0) + count
                        global_multiclass_distribution[val] = global_multiclass_distribution.get(val, 0) + count

                        # Binary distribution mapping: BENIGN -> 0, others -> 1
                        binary_val = 0 if val == 'BENIGN' else 1
                        file_binary_distribution[binary_val] = file_binary_distribution.get(binary_val, 0) + count
                        global_binary_distribution[binary_val] = global_binary_distribution.get(binary_val, 0) + count
                else:
                    # 'Label' is missing entirely in this chunk's columns
                    pass

            # Print file summary
            print(f"  - Satır Sayısı  : {total_rows}")
            print(f"  - Sütun Sayısı  : {len(columns_list)}")
            print(f"  - Sütun İsimleri: {columns_list}")

            print("  - Veri Tipleri  :")
            for col, dtype in dtypes_dict.items():
                print(f"    * {col}: {dtype}")

            print(f"  - Toplam NaN Sayısı       : {total_nans}")
            print(f"  - Toplam Infinity Sayısı  : {total_infs}")
            print(f"  - Duplicate Satır Sayısı  : {duplicate_count}")
            print(f"  - Eksik Label Sayısı      : {file_missing_labels}")

            # Print Multiclass Distribution
            print("  - Orijinal Çok Sınıflı Label Dağılımı:")
            total_valid_labels = sum(file_multiclass_distribution.values())
            if total_valid_labels > 0:
                sorted_multiclass = sorted(file_multiclass_distribution.items(), key=lambda x: x[1], reverse=True)
                for label_val, label_count in sorted_multiclass:
                    pct = (label_count / total_valid_labels) * 100
                    print(f"    * {label_val:25s}: {label_count:7d} adet ({pct:.2f}%)")
            else:
                print("    * Hata: Geçerli çok sınıflı etiket bulunamadı!")

            # Print Binary Distribution
            print("  - İkili Label Dağılımı (BENIGN = 0, Saldırılar = 1):")
            if total_valid_labels > 0:
                normal_count = file_binary_distribution.get(0, 0)
                attack_count = file_binary_distribution.get(1, 0)
                normal_pct = (normal_count / total_valid_labels) * 100
                attack_pct = (attack_count / total_valid_labels) * 100
                print(f"    * Normal (0)              : {normal_count:7d} adet ({normal_pct:.2f}%)")
                print(f"    * Saldırı (1)             : {attack_count:7d} adet ({attack_pct:.2f}%)")
            else:
                print("    * Hata: Geçerli ikili etiket bulunamadı!")
            print()

        except Exception as e:
            print(f"  [ERROR] An error occurred while processing this file: {e}\n")
            failed_files.append((file_name, str(e)))

    print("==================================================")
    print("        GLOBAL COMBINED CLASS DISTRIBUTION        ")
    print("==================================================")
    total_global_valid = sum(global_multiclass_distribution.values())

    print(f"  Total Missing Labels: {global_missing_labels}")

    if total_global_valid > 0:
        print("\n  1. Global Multiclass Label Distribution:")
        sorted_global_multi = sorted(global_multiclass_distribution.items(), key=lambda x: x[1], reverse=True)
        for label_val, label_count in sorted_global_multi:
            pct = (label_count / total_global_valid) * 100
            print(f"    * {label_val:25s}: {label_count:7d} records ({pct:.2f}%)")

        print("\n  2. Global Binary Label Distribution (BENIGN = 0, Attack = 1):")
        global_normal = global_binary_distribution.get(0, 0)
        global_attack = global_binary_distribution.get(1, 0)
        global_normal_pct = (global_normal / total_global_valid) * 100
        global_attack_pct = (global_attack / total_global_valid) * 100
        print(f"    * Normal (0)              : {global_normal:7d} records ({global_normal_pct:.2f}%)")
        print(f"    * Attack (1)              : {global_attack:7d} records ({global_attack_pct:.2f}%)")
        print(f"    * Total Valid Records     : {total_global_valid}")
    else:
        print("  No records processed successfully.")

    print("==================================================")

    if failed_files:
        print("\n[CRITICAL] The following files encountered errors and could not be analyzed:")
        for idx, (name, error_msg) in enumerate(failed_files, 1):
            print(f"  {idx}. {name}: {error_msg}")
        sys.exit(1)

if __name__ == "__main__":
    analyze_dataset()
