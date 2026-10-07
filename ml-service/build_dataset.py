import csv
import random

# Legitimate clinical symptoms associated with common gastrointestinal / stomach conditions:
# Classes:
# 1. GERD (Gastroesophageal Reflux Disease)
# 2. Peptic Ulcer Disease
# 3. Gastroenteritis (Stomach Flu)
# 4. Gastritis
# 5. Irritable Bowel Syndrome (IBS)
# 6. Constipation
# 7. Food Poisoning

symptoms_list = [
    "abdominal_pain",
    "bloating",
    "gas",
    "nausea",
    "vomiting",
    "heartburn",
    "acid_reflux",
    "diarrhea",
    "constipation",
    "loss_of_appetite",
    "indigestion",
    "cramping",
    "fever",
    "belching",
    "watery_stool",
    "hard_stool",
    "early_satiety",
    "stomach_burning"
]

disease_profiles = {
    "GERD": {
        "core": ["heartburn", "acid_reflux", "indigestion"],
        "common": ["belching", "bloating", "nausea"],
        "rare": ["abdominal_pain", "loss_of_appetite"]
    },
    "Peptic Ulcer Disease": {
        "core": ["abdominal_pain", "stomach_burning", "indigestion"],
        "common": ["nausea", "bloating", "belching", "early_satiety"],
        "rare": ["vomiting", "loss_of_appetite"]
    },
    "Gastroenteritis": {
        "core": ["diarrhea", "vomiting", "nausea", "cramping"],
        "common": ["abdominal_pain", "watery_stool", "fever", "loss_of_appetite"],
        "rare": ["bloating", "gas"]
    },
    "Gastritis": {
        "core": ["stomach_burning", "indigestion", "bloating"],
        "common": ["nausea", "abdominal_pain", "belching", "loss_of_appetite"],
        "rare": ["vomiting", "gas"]
    },
    "Irritable Bowel Syndrome": {
        "core": ["abdominal_pain", "bloating", "cramping"],
        "common": ["gas", "diarrhea", "constipation", "indigestion"],
        "rare": ["nausea", "early_satiety"]
    },
    "Constipation": {
        "core": ["constipation", "hard_stool", "bloating"],
        "common": ["abdominal_pain", "gas", "cramping"],
        "rare": ["indigestion", "loss_of_appetite"]
    },
    "Food Poisoning": {
        "core": ["vomiting", "diarrhea", "nausea", "fever"],
        "common": ["cramping", "abdominal_pain", "watery_stool"],
        "rare": ["bloating", "gas"]
    }
}

random.seed(42)

rows = []
# Generate 700 clinical case representations (100 samples per disease class with natural symptom variations)
for disease, profile in disease_profiles.items():
    for _ in range(100):
        sample = {s: 0 for s in symptoms_list}
        # Core symptoms have 85-98% probability
        for s in profile["core"]:
            if random.random() < 0.92:
                sample[s] = 1
        # Common symptoms have 45-75% probability
        for s in profile["common"]:
            if random.random() < 0.60:
                sample[s] = 1
        # Rare symptoms have 10-25% probability
        for s in profile["rare"]:
            if random.random() < 0.18:
                sample[s] = 1
        # Background noise (any symptom 3% chance)
        for s in symptoms_list:
            if s not in profile["core"] and s not in profile["common"] and s not in profile["rare"]:
                if random.random() < 0.04:
                    sample[s] = 1
                    
        # Ensure at least 2 symptoms are present
        if sum(sample.values()) < 2:
            for s in profile["core"][:2]:
                sample[s] = 1
                
        sample["disease"] = disease
        rows.append(sample)

csv_path = "a:/unthinkable/healthcare-manager/ml-service/dataset/stomach_symptoms_dataset.csv"
with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=symptoms_list + ["disease"])
    writer.writeheader()
    writer.writerows(rows)

print(f"Dataset generated successfully at {csv_path} with {len(rows)} samples across {len(disease_profiles)} conditions.")
