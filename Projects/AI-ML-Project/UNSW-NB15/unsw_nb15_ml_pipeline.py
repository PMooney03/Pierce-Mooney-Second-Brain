from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

base_dir = Path(__file__).resolve().parent
train_path = base_dir / "UNSW_NB15_training-set.csv"
test_path  = base_dir / "UNSW_NB15_testing-set.csv"

if not train_path.exists() or not test_path.exists():
    raise FileNotFoundError(f"Missing dataset files:\n{train_path}\n{test_path}")

train_df = pd.read_csv(train_path)
test_df  = pd.read_csv(test_path)
data = pd.concat([train_df, test_df], ignore_index=True)
print("Combined UNSW-NB15 shape:", data.shape)

data.columns = data.columns.str.strip()

if "label" not in data.columns:
    raise KeyError("Could not find 'label' column in UNSW-NB15 dataset.")

data["Label"] = data["label"].astype(int)

non_numeric_cols = [col for col in data.columns if data[col].dtype == "object"]
data = data.drop(columns=non_numeric_cols, errors="ignore")

data = data.drop(columns=["label"], errors="ignore")

X = data.drop("Label", axis=1)
y = data["Label"]

X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y, test_size=0.2, random_state=42, stratify=y
)

models = {
    "Logistic Regression": LogisticRegression(max_iter=1000),
    "Decision Tree": DecisionTreeClassifier(max_depth=10, random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=100, n_jobs=-1, random_state=42)
}

results = {}

for name, clf in models.items():
    print(f"\nTraining {name}...")
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1] if hasattr(clf, "predict_proba") else y_pred

    report = classification_report(y_test, y_pred, output_dict=True)
    auc = roc_auc_score(y_test, y_prob)
    cm = confusion_matrix(y_test, y_pred)

    results[name] = {"classification_report": report, "roc_auc": auc, "confusion_matrix": cm}

    print(f"\n{name} Results:")
    print(classification_report(y_test, y_pred))
    print("ROC-AUC:", auc)
    print("Confusion Matrix:\n", cm)

fig, axes = plt.subplots(1, 3, figsize=(18, 5), constrained_layout=True)
im = None
for idx, (name, res) in enumerate(results.items()):
    ax = axes[idx]
    cm = res["confusion_matrix"]
    im = ax.imshow(cm, cmap="Blues")
    ax.set_title(name)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, cm[i, j], ha="center", va="center", color="red", fontsize=10)
fig.colorbar(im, ax=axes.ravel().tolist()).ax.set_ylabel("Count", rotation=270, labelpad=15)

out_dir = Path("/mnt/d/College/AI-ML/DemoScreenshots")
out_dir.mkdir(parents=True, exist_ok=True)
out_path = out_dir / "UNSW-NB15_confusions.png"
plt.savefig(out_path, dpi=200)
print(f"Saved confusion matrices to: {out_path}")
