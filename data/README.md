# CIC-IDS 2017 Dataset

## Source

The CIC-IDS 2017 dataset is publicly available from the Canadian Institute for Cybersecurity (CIC):

https://www.unb.ca/cic/datasets/ids-2017.html

## Download Instructions

1. Visit the URL above
2. Click on "CIC-IDS-2017" to access the dataset
3. Download the CSV files (GeneratedLabelledFlows.zip or individual day CSVs)
4. Extract to this `data/` directory

## Expected Files

The dataset typically contains 8 CSV files, one per capture day:

```
data/
├── Monday-WorkingHours.pcap_ISCX.csv
├── Tuesday-WorkingHours.pcap_ISCX.csv
├── Wednesday-WorkingHours.pcap_ISCX.csv
├── Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv
├── Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv
├── Friday-WorkingHours-Morning.pcap_ISCX.csv
├── Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv
└── Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv
```

You can upload any single CSV file to the application via the dashboard.

## Dataset Statistics

- Total records: ~2.8 million flows
- Features: 84 flow-level features (packet statistics, duration, flags, etc.)
- Label column: `Label` (last column, note the leading space in raw files)
- Class distribution:
  - BENIGN: ~80%
  - DoS Hulk: ~8%
  - PortScan: ~6%
  - DDoS: ~4%
  - DoS GoldenEye: ~1%
  - FTP-Patator: ~0.5%
  - SSH-Patator: ~0.4%
  - Other attacks: <0.5% each

## Important Notes

1. **File size**: Each CSV is 100–500 MB. The full dataset is ~6 GB.
2. **Label format**: The raw CSV label column has a leading space (` Label`). 
   The preprocessing pipeline handles this automatically.
3. **Known issues**: Some rows contain Inf/-Inf values in flow rate columns 
   (division by zero for zero-duration flows). These are handled by the pipeline.
4. **Encoding**: Files are typically UTF-8 or latin-1. The loader tries both.

## Demo Mode

If you don't have the CIC-IDS 2017 dataset, you can use the built-in demo mode:

1. Open the dashboard
2. Click "Load Demo Dataset" 
3. The system generates synthetic data with a similar structure

**IMPORTANT**: Demo mode uses SYNTHETIC data. Results do NOT represent
real CIC-IDS 2017 performance and must NOT be presented as such.

## Citation

CICIDS2017 dataset:
  Iman Sharafaldin, Arash Habibi Lashkari, and Ali A. Ghorbani,
  "Toward Generating a New Intrusion Detection Dataset and Intrusion Traffic Characterization",
  4th International Conference on Information Systems Security and Privacy (ICISSP),
  January 2018, Portugal.
