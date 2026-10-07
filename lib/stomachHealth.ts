/**
 * Stomach health domain knowledge, red-flag triage rules, and lifestyle guidance.
 * Note: Purely educational and advisory; strictly NOT a medical diagnosis.
 */

export interface StomachSymptomDefinition {
  id: string;
  label: string;
  description: string;
  category: 'upper_gi' | 'lower_gi' | 'systemic';
}

export const SUPPORTED_SYMPTOMS: StomachSymptomDefinition[] = [
  { id: 'heartburn', label: 'Heartburn / Burning in Chest', description: 'Burning sensation rising behind the breastbone', category: 'upper_gi' },
  { id: 'acid_reflux', label: 'Acid Reflux', description: 'Sour or bitter fluid regurgitating into throat', category: 'upper_gi' },
  { id: 'stomach_burning', label: 'Stomach Burning', description: 'Gnawing or burning ache in upper abdomen', category: 'upper_gi' },
  { id: 'indigestion', label: 'Indigestion (Dyspepsia)', description: 'Discomfort, fullness, or heaviness after meals', category: 'upper_gi' },
  { id: 'bloating', label: 'Bloating', description: 'Abdominal tightness or visibly distended belly', category: 'upper_gi' },
  { id: 'belching', label: 'Excessive Belching / Burping', description: 'Frequent expulsion of air from stomach', category: 'upper_gi' },
  { id: 'early_satiety', label: 'Early Satiety', description: 'Feeling uncomfortably full after eating very little', category: 'upper_gi' },
  { id: 'nausea', label: 'Nausea', description: 'Feeling sick with an inclination to vomit', category: 'upper_gi' },
  { id: 'vomiting', label: 'Vomiting', description: 'Forceful expulsion of stomach contents', category: 'upper_gi' },
  { id: 'abdominal_pain', label: 'Abdominal Pain', description: 'Aching or cramping anywhere in the stomach area', category: 'lower_gi' },
  { id: 'cramping', label: 'Abdominal Cramping', description: 'Intermittent painful spasms', category: 'lower_gi' },
  { id: 'gas', label: 'Excessive Gas / Flatulence', description: 'Intestinal gas buildup', category: 'lower_gi' },
  { id: 'diarrhea', label: 'Diarrhea', description: 'Frequent loose or liquid bowel movements', category: 'lower_gi' },
  { id: 'watery_stool', label: 'Watery Stool', description: 'Completely liquid or urgent bowel movements', category: 'lower_gi' },
  { id: 'constipation', label: 'Constipation', description: 'Infrequent, straining, or difficult bowel movements', category: 'lower_gi' },
  { id: 'hard_stool', label: 'Hard / Dry Stools', description: 'Dry, lumpy stool texture', category: 'lower_gi' },
  { id: 'loss_of_appetite', label: 'Loss of Appetite', description: 'Reduced desire or interest in eating', category: 'systemic' },
  { id: 'fever', label: 'Fever or Chills', description: 'Elevated body temperature', category: 'systemic' },
];

export interface RedFlagDefinition {
  id: string;
  label: string;
  warningText: string;
}

export const RED_FLAG_SYMPTOMS: RedFlagDefinition[] = [
  { id: 'blood_in_vomit', label: 'Blood in vomit (hematemesis or coffee-ground material)', warningText: 'Vomiting blood indicates potential gastrointestinal bleeding.' },
  { id: 'black_tarry_stool', label: 'Black, tarry, or bloody stool (melena)', warningText: 'Black or tarry stools can indicate active upper digestive bleeding.' },
  { id: 'severe_unbearable_pain', label: 'Sudden, severe, or unbearable abdominal pain', warningText: 'Acute severe pain may indicate conditions requiring immediate surgical evaluation (e.g. perforation or appendicitis).' },
  { id: 'difficulty_swallowing', label: 'Difficulty or painful swallowing (dysphagia)', warningText: 'Swallowing difficulty can indicate structural or neurological obstruction.' },
  { id: 'unexplained_weight_loss', label: 'Rapid, unexplained weight loss', warningText: 'Unintended weight loss with digestive symptoms needs in-person clinical assessment.' },
  { id: 'persistent_vomiting_fluids', label: 'Inability to keep liquids down for > 24 hours', warningText: 'High risk of severe dehydration and electrolyte imbalance.' },
  { id: 'chest_pain_shortness_breath', label: 'Chest pain radiating to arm, neck, or shortness of breath', warningText: 'Chest pain can mimic indigestion but requires urgent cardiovascular exclusion.' },
  { id: 'fainting_dizziness', label: 'Fainting, severe dizziness, or confusion', warningText: 'May indicate hemodynamic compromise or hypovolemic shock.' },
];

export interface ConditionGuidance {
  condition: string;
  displayName: string;
  description: string;
  suggestedSpecialty: string;
  generalGuidance: string[];
  whenToConsult: string[];
}

export const CONDITION_GUIDANCE_MAP: Record<string, ConditionGuidance> = {
  GERD: {
    condition: 'GERD',
    displayName: 'Gastroesophageal Reflux Disease (GERD)',
    description: 'Occurs when stomach acid repeatedly flows back into the tube connecting your mouth and stomach (esophagus).',
    suggestedSpecialty: 'Gastroenterologist',
    generalGuidance: [
      'Eat smaller, more frequent meals rather than large heavy dinners.',
      'Avoid lying down or reclining for at least 2–3 hours after eating.',
      'Elevate the head of your bed by 6 inches if nighttime reflux occurs.',
      'Limit known triggers such as coffee, citrus fruits, tomatoes, spicy dishes, and carbonated drinks.',
      'Wear loose-fitting clothing around the waist to reduce intra-abdominal pressure.',
    ],
    whenToConsult: [
      'Heartburn occurs more than twice a week despite dietary adjustments.',
      'You experience difficulty or pain when swallowing.',
      'Symptoms interfere with restful sleep.',
    ],
  },
  'Peptic Ulcer Disease': {
    condition: 'Peptic Ulcer Disease',
    displayName: 'Peptic Ulcer Disease / Gastric Irritation',
    description: 'Open sores that develop on the inside lining of your stomach and the upper portion of your small intestine.',
    suggestedSpecialty: 'Gastroenterologist',
    generalGuidance: [
      'Avoid taking non-steroidal anti-inflammatory drugs (NSAIDs like ibuprofen or aspirin) without medical advice.',
      'Eat regular, non-spicy meals; avoid prolonged fasting if it worsens stomach burning.',
      'Avoid alcohol and smoking as they impair the stomach mucosal barrier.',
      'Stay well hydrated with plain room-temperature water.',
    ],
    whenToConsult: [
      'Gnawing abdominal pain persists or worsens on an empty stomach.',
      'Pain wakes you up during the night.',
      'You experience vomiting or progressive appetite loss.',
    ],
  },
  Gastritis: {
    condition: 'Gastritis',
    displayName: 'Gastritis (Stomach Lining Inflammation)',
    description: 'Inflammation, irritation, or erosion of the protective mucosal lining of the stomach.',
    suggestedSpecialty: 'Gastroenterologist',
    generalGuidance: [
      'Choose bland, easy-to-digest foods (rice, oats, bananas, light soups).',
      'Refrain from strong coffee, spicy sauces, alcohol, and acidic juices.',
      'Eat slowly in a relaxed environment and chew thoroughly.',
      'Avoid skipping meals or prolonged fasting intervals.',
    ],
    whenToConsult: [
      'Stomach burning or nausea lasts longer than 48 hours.',
      'You are unable to tolerate nutritious food.',
      'Symptoms are accompanied by unexplained fatigue.',
    ],
  },
  Gastroenteritis: {
    condition: 'Gastroenteritis',
    displayName: 'Gastroenteritis (Stomach Infection / Flu)',
    description: 'An intestinal infection marked by watery diarrhea, abdominal cramps, nausea or vomiting, and sometimes fever.',
    suggestedSpecialty: 'General Physician',
    generalGuidance: [
      'Prioritize rehydration with oral rehydration salts (ORS), clear broths, and coconut water.',
      'Take small, frequent sips of fluid rather than large gulps to avoid provoking vomiting.',
      'Gradually introduce bland foods (BRAT diet: bananas, rice, applesauce, toast) once vomiting subsides.',
      'Rest adequately and practice strict hand hygiene to prevent spreading infection.',
    ],
    whenToConsult: [
      'Diarrhea lasts more than 2–3 days without improvement.',
      'Signs of dehydration appear: dry mouth, minimal or dark urine, lightheadedness.',
      'High fever (> 101°F / 38.3°C) persists.',
    ],
  },
  'Irritable Bowel Syndrome': {
    condition: 'Irritable Bowel Syndrome',
    displayName: 'Irritable Bowel Syndrome (IBS)',
    description: 'A common disorder affecting the large intestine, characterized by cramping, abdominal pain, bloating, gas, and bowel habit alterations.',
    suggestedSpecialty: 'Gastroenterologist',
    generalGuidance: [
      'Keep a daily food and symptom journal to identify specific triggers.',
      'Experiment with low-FODMAP dietary options under clinical supervision.',
      'Incorporate gentle stress-reduction practices (deep breathing, yoga, light walking).',
      'Maintain consistent meal and sleep schedules.',
    ],
    whenToConsult: [
      'Bowel habits fluctuate significantly and persist for several weeks.',
      'Symptoms significantly affect quality of life or work activities.',
      'Symptom onset occurs for the first time after age 50.',
    ],
  },
  Constipation: {
    condition: 'Constipation',
    displayName: 'Functional Constipation',
    description: 'Infrequent bowel movements or difficult passage of stools that persists over multiple days.',
    suggestedSpecialty: 'General Physician',
    generalGuidance: [
      'Increase dietary fiber gradually with legumes, whole grains, vegetables, and prunes.',
      'Drink 8–10 glasses of water daily unless restricted by a doctor.',
      'Engage in daily physical activity such as brisk walking to stimulate bowel peristalsis.',
      'Do not postpone or ignore the natural urge to have a bowel movement.',
    ],
    whenToConsult: [
      'Constipation lasts longer than one week despite fiber and hydration.',
      'Severe abdominal cramps or inability to pass gas occurs.',
      'Constipation alternates with episodes of diarrhea.',
    ],
  },
  'Food Poisoning': {
    condition: 'Food Poisoning',
    displayName: 'Acute Foodborne Illness',
    description: 'Illness caused by eating contaminated, spoiled, or toxic food, presenting abruptly with nausea, vomiting, or diarrhea.',
    suggestedSpecialty: 'General Physician',
    generalGuidance: [
      'Allow your stomach to settle by resting from solid foods for the first few hours.',
      'Sip electrolytes and ORS solutions slowly to replenish salts lost from vomiting and diarrhea.',
      'Avoid dairy, fatty, fried, and sugary foods until your digestion normalizes.',
      'Avoid taking anti-diarrheal medicines without a doctor’s recommendation if fever is present.',
    ],
    whenToConsult: [
      'Vomiting persists for more than 24 hours.',
      'You cannot retain liquids or exhibit extreme thirst and dry mouth.',
      'Fever exceeds 102°F (38.9°C).',
    ],
  },
};
