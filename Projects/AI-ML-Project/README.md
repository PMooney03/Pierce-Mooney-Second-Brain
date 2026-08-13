# AI/ML Network Intrusion Detection

Machine learning project for identifying malicious network traffic using two widely used intrusion detection datasets: **CICIDS2017** and **UNSW-NB15**.

Three classifiers are trained and evaluated on each dataset after cleaning, preprocessing, and an **80% / 20%** train–test split.

## Results

| Model | CICIDS2017 | UNSW-NB15 |
|-------|:----------:|:---------:|
| Random Forest | **100%** | **98%** |
| Decision Tree | 100% | 97% |
| Logistic Regression | 94% | 89% |

**Random Forest** achieved the strongest overall performance across both datasets.

## Models

- **Random Forest** — ensemble of decision trees; best accuracy on both datasets
- **Decision Tree** — single tree with `max_depth=10`
- **Logistic Regression** — linear baseline classifier

Each model is evaluated with classification reports, ROC-AUC scores, and confusion matrices.

## Technologies

- Python
- pandas
- NumPy
- scikit-learn
- Matplotlib
- Jupyter Notebook (optional for exploration)

## Repository Structure

```
AI-ML-Project/
├── CICIDS2017/
│   └── MachineLearningCVE/
│       ├── cicids2017_ml_pipeline.py
│       └── *.csv                    # CICIDS2017 CSV files (not tracked in git)
├── UNSW-NB15/
│   ├── unsw_nb15_ml_pipeline.py
│   ├── UNSW_NB15_training-set.csv # not tracked in git
│   └── UNSW_NB15_testing-set.csv  # not tracked in git
├── Screenshots/
├── requirements.txt
├── makefile
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.8+
- [Make](https://www.gnu.org/software/make/) (optional, for convenience targets)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/AI-ML-Project.git
cd AI-ML-Project
```

### 2. Install dependencies

Using the Makefile (creates a virtual environment automatically):

```bash
make dev
```

Or manually:

```bash
python -m venv .venv
source .venv/bin/activate        # Linux / macOS
# .venv\Scripts\activate         # Windows

pip install -r requirements.txt
```

### 3. Download the datasets

Dataset CSV files are excluded from version control due to size. Place them as follows:

**CICIDS2017** — download the [MachineLearningCVE CSV files](https://www.unb.ca/cic/datasets/ids-2017.html) into:

```
CICIDS2017/MachineLearningCVE/
```

**UNSW-NB15** — download the [training and testing sets](https://research.unsw.edu.au/projects/unsw-nb15-dataset) into:

```
UNSW-NB15/UNSW_NB15_training-set.csv
UNSW-NB15/UNSW_NB15_testing-set.csv
```

## Usage

Run both pipelines:

```bash
make run_all
```

Run individually:

```bash
make run_cicids    # CICIDS2017 only
make run_unsw      # UNSW-NB15 only
```

Or run the scripts directly:

```bash
python CICIDS2017/MachineLearningCVE/cicids2017_ml_pipeline.py
python UNSW-NB15/unsw_nb15_ml_pipeline.py
```

Each pipeline will:

1. Load and combine dataset CSV files
2. Clean data (strip column names, handle infinities/NaNs, drop non-numeric columns)
3. Encode labels (benign vs. attack)
4. Scale features with `StandardScaler`
5. Split into 80% training / 20% testing (stratified)
6. Train all three models and print metrics
7. Save confusion matrix plots

## Pipeline Details

### CICIDS2017

- Loads all `.csv` files from `CICIDS2017/MachineLearningCVE/`
- Maps the `Label` column to binary classification: **Benign → 0**, all attack types → **1**

### UNSW-NB15

- Combines the official training and testing CSV files
- Uses the existing `label` column (0 = normal, 1 = attack)
- Applies the same preprocessing and 80/20 split as CICIDS2017

## Output

Each pipeline saves a confusion matrix plot:

- `CICIDS2017_confusions.png`
- `UNSW-NB15_confusions.png`

By default, plots are written to the `out_dir` path defined at the bottom of each pipeline script. Change that path to save results into the `Screenshots/` folder or any directory you prefer.

## License

This project is for educational purposes. Dataset usage is subject to the terms of the original publishers:

- [CICIDS2017](https://www.unb.ca/cic/datasets/ids-2017.html)
- [UNSW-NB15](https://research.unsw.edu.au/projects/unsw-nb15-dataset)
