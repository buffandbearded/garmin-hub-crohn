/* Static reference data: training program, exercise library, lab markers, Crohn's notes.
   General education, not medical advice. Edit freely. */
window.K = (function () {
  const MUSCLES = [
    { k: "Chest", min: 10, max: 16 }, { k: "Back", min: 12, max: 18 }, { k: "Shoulders", min: 10, max: 18 },
    { k: "Biceps", min: 8, max: 14 }, { k: "Triceps", min: 8, max: 14 }, { k: "Quads", min: 10, max: 16 },
    { k: "Hamstrings", min: 8, max: 14 }, { k: "Glutes", min: 6, max: 14 }, { k: "Calves", min: 8, max: 14 }, { k: "Abs", min: 6, max: 12 }
  ];

  // joints: which joints the lift loads most. subs: swap if that joint hurts. inc: smallest sensible load jump (kg).
  const EX = {
    incdb:   { n: "Incline dumbbell press (30°)", p: ["Chest"], s: ["Shoulders", "Triceps"], j: ["shoulder", "elbow"], inc: 2, subs: { shoulder: "machinepress", elbow: "cablefly" }, cue: "Shoulder blades pinned back and down, elbows ~45° from torso, full stretch at the bottom without letting the shoulders roll forward." },
    machinepress: { n: "Chest press machine", p: ["Chest"], s: ["Triceps", "Shoulders"], j: ["shoulder"], inc: 2.5, subs: { shoulder: "cablefly" }, cue: "Seat so handles are at mid-chest. Stable and easy on joints, good for pushing close to failure." },
    cablefly: { n: "Cable fly (low-to-high)", p: ["Chest"], s: [], j: ["shoulder"], inc: 1.25, subs: {}, cue: "Slight elbow bend that stays fixed. Stretch under control, squeeze in front of the chest." },
    chestrow: { n: "Chest-supported row", p: ["Back"], s: ["Biceps", "Shoulders"], j: ["elbow"], inc: 2.5, subs: {}, cue: "Pull elbows toward hips, pause at the squeeze. The chest support takes the lower back out of the movement." },
    pulldown: { n: "Lat pulldown (neutral or wide grip)", p: ["Back"], s: ["Biceps"], j: ["shoulder", "elbow"], inc: 2.5, subs: { shoulder: "neutralpulldown" }, cue: "Lean back slightly, lead with the elbows, bar to upper chest. Full stretch overhead only if the shoulders feel fine." },
    neutralpulldown: { n: "Neutral-grip pulldown / pull-up", p: ["Back"], s: ["Biceps"], j: ["elbow"], inc: 2.5, subs: {}, cue: "Palms facing each other is the most shoulder-friendly vertical pull." },
    cablerow: { n: "One-arm cable row", p: ["Back"], s: ["Biceps"], j: ["elbow"], inc: 2.5, subs: {}, cue: "Let the shoulder blade reach forward at the start, then drive the elbow back." },
    latraise: { n: "Cable or dumbbell lateral raise", p: ["Shoulders"], s: [], j: ["shoulder"], inc: 1, subs: { shoulder: "cablelatraise" }, cue: "Raise to just below shoulder height, lead with the elbow, no swinging." },
    cablelatraise: { n: "Cable lateral raise (low pulley)", p: ["Shoulders"], s: [], j: [], inc: 1.25, subs: {}, cue: "Constant tension, lighter on the joint than dumbbells at the bottom." },
    facepull: { n: "Face pull / rear-delt fly", p: ["Shoulders", "Back"], s: [], j: [], inc: 1.25, subs: {}, cue: "Light and high-rep. Thumbs back, pull toward the forehead, squeeze the upper back." },
    shoulderpress: { n: "Seated shoulder press (dumbbell or machine)", p: ["Shoulders"], s: ["Triceps", "Chest"], j: ["shoulder", "elbow"], inc: 2, subs: { shoulder: "latraise" }, cue: "Back supported, forearms vertical, press slightly in front of the body (scapular plane)." },
    pushdown: { n: "Cable triceps pushdown", p: ["Triceps"], s: [], j: ["elbow"], inc: 2.5, subs: { elbow: "overheadext" }, cue: "Elbows pinned to the sides, full lockout, slow return." },
    overheadext: { n: "Overhead cable triceps extension", p: ["Triceps"], s: [], j: ["elbow"], inc: 2.5, subs: { elbow: "pushdown" }, cue: "Long head gets the best stretch overhead. Keep the ribs down and the elbows narrow." },
    inclinecurl: { n: "Incline dumbbell curl", p: ["Biceps"], s: [], j: ["elbow", "wrist"], inc: 1, subs: { elbow: "hammercurl" }, cue: "Arms hang behind the torso for a deep stretch. Don't swing." },
    hammercurl: { n: "Hammer curl / cable curl", p: ["Biceps"], s: [], j: ["elbow"], inc: 1, subs: {}, cue: "Neutral wrist position is usually kinder to the elbow and wrist." },
    hack: { n: "Hack squat or leg press (deep, controlled)", p: ["Quads"], s: ["Glutes"], j: ["knee", "hip"], inc: 5, subs: { knee: "legext" }, cue: "Feet shoulder-width, go as deep as you can with heels down and a flat lower back. Knees track over toes." },
    squat: { n: "Back squat or safety-bar squat", p: ["Quads"], s: ["Glutes", "Hamstrings"], j: ["knee", "lowback", "hip"], inc: 2.5, subs: { lowback: "hack", knee: "hack" }, cue: "Brace with a big breath, ribs down, controlled descent, stay tight out of the hole." },
    rdl: { n: "Romanian deadlift", p: ["Hamstrings"], s: ["Glutes", "Back"], j: ["lowback", "hip"], inc: 2.5, subs: { lowback: "legcurl" }, cue: "Push hips back, soft knees, bar stays against the legs, stop when the hamstrings are stretched. Back stays neutral." },
    legext: { n: "Leg extension", p: ["Quads"], s: [], j: ["knee"], inc: 2.5, subs: {}, cue: "Hold the top for a beat, lower slowly. Pad just above the ankle." },
    legcurl: { n: "Seated leg curl", p: ["Hamstrings"], s: [], j: ["knee"], inc: 2.5, subs: {}, cue: "Seated version stretches the hamstrings more than lying. Full range, slow return." },
    calf: { n: "Standing calf raise (full range, 1 s pause at the stretch)", p: ["Calves"], s: [], j: ["ankle"], inc: 2.5, subs: { ankle: "seatedcalf" }, cue: "Deep stretch, pause, then press through the big toe. No bouncing." },
    seatedcalf: { n: "Seated calf raise", p: ["Calves"], s: [], j: ["ankle"], inc: 2.5, subs: {}, cue: "Same deep stretch and pause. Works the soleus." },
    cablecrunch: { n: "Cable crunch", p: ["Abs"], s: [], j: ["lowback"], inc: 2.5, subs: { lowback: "pallof" }, cue: "Curl the ribs toward the pelvis, don't just bow forward from the hips." },
    pallof: { n: "Pallof press", p: ["Abs"], s: [], j: [], inc: 1.25, subs: {}, cue: "Resist rotation. Gentle on the spine and good for bracing practice." },
    trapdl: { n: "Trap-bar deadlift", p: ["Quads", "Glutes"], s: ["Hamstrings", "Back"], j: ["lowback", "hip", "knee"], inc: 5, subs: { lowback: "rdl" }, cue: "More upright torso than a conventional pull, so less shear on the lower back. Push the floor away." },
    bulgarian: { n: "Bulgarian split squat", p: ["Quads", "Glutes"], s: ["Hamstrings"], j: ["knee", "hip"], inc: 2, subs: { knee: "legext" }, cue: "Slight forward torso lean for glutes, upright for quads. Front foot far enough out to keep the heel planted." },
    hipthrust: { n: "Hip thrust", p: ["Glutes"], s: ["Hamstrings"], j: ["hip", "lowback"], inc: 5, subs: {}, cue: "Chin tucked, ribs down, finish with the glutes not the lower back. Pause at the top." },
    backext: { n: "45° back extension", p: ["Glutes", "Hamstrings"], s: ["Back"], j: ["lowback"], inc: 2.5, subs: {}, cue: "Hinge from the hips, stop at a neutral spine." }
  };

  const R = (id, sets, lo, hi, rir, rest) => ({ id, sets, reps: [lo, hi], rir, rest });
  const PROGRAMS = {
    4: {
      name: "4 days: Upper / Lower",
      why: "Every muscle is trained twice a week, which is a very efficient way to reach 10 to 16 weekly sets with high-quality sets and room to recover between sessions.",
      days: [
        { name: "Upper A", focus: "Horizontal push and pull", ex: [R("incdb", 3, 6, 10, 2, "2-3 min"), R("chestrow", 3, 8, 12, 2, "2 min"), R("pulldown", 3, 8, 12, 2, "2 min"), R("latraise", 3, 12, 20, 1, "1-2 min"), R("overheadext", 3, 10, 15, 1, "1-2 min"), R("inclinecurl", 3, 10, 15, 1, "1-2 min"), R("facepull", 2, 15, 20, 2, "1 min")] },
        { name: "Lower A", focus: "Quad emphasis", ex: [R("hack", 3, 6, 10, 2, "3 min"), R("rdl", 3, 8, 10, 2, "2-3 min"), R("legext", 3, 10, 15, 1, "1-2 min"), R("legcurl", 3, 10, 15, 1, "1-2 min"), R("calf", 3, 8, 12, 1, "1-2 min"), R("cablecrunch", 3, 10, 15, 1, "1 min")] },
        { name: "Upper B", focus: "Vertical push and pull", ex: [R("shoulderpress", 3, 6, 10, 2, "2-3 min"), R("neutralpulldown", 3, 6, 10, 2, "2 min"), R("cablefly", 3, 10, 15, 1, "1-2 min"), R("cablerow", 3, 10, 12, 2, "2 min"), R("latraise", 3, 12, 20, 1, "1-2 min"), R("pushdown", 3, 10, 15, 1, "1-2 min"), R("hammercurl", 3, 10, 15, 1, "1-2 min")] },
        { name: "Lower B", focus: "Hip hinge and glutes", ex: [R("trapdl", 3, 5, 8, 2, "3 min"), R("bulgarian", 3, 8, 12, 2, "2 min"), R("hipthrust", 3, 8, 12, 2, "2 min"), R("legcurl", 3, 10, 15, 1, "1-2 min"), R("seatedcalf", 3, 12, 15, 1, "1-2 min"), R("pallof", 3, 10, 12, 2, "1 min")] }
      ]
    },
    3: {
      name: "3 days: Full body",
      why: "Three full-body sessions give each muscle three exposures a week with fewer, shorter weekly commitments. A good choice if recovery or schedule is tight.",
      days: [
        { name: "Full A", focus: "Squat and horizontal push/pull", ex: [R("hack", 3, 6, 10, 2, "3 min"), R("incdb", 3, 6, 10, 2, "2-3 min"), R("chestrow", 3, 8, 12, 2, "2 min"), R("legcurl", 2, 10, 15, 1, "1-2 min"), R("latraise", 3, 12, 20, 1, "1-2 min"), R("inclinecurl", 2, 10, 15, 1, "1-2 min"), R("calf", 2, 8, 12, 1, "1-2 min")] },
        { name: "Full B", focus: "Hinge and vertical push/pull", ex: [R("rdl", 3, 8, 10, 2, "2-3 min"), R("shoulderpress", 3, 6, 10, 2, "2-3 min"), R("neutralpulldown", 3, 6, 10, 2, "2 min"), R("bulgarian", 2, 8, 12, 2, "2 min"), R("overheadext", 3, 10, 15, 1, "1-2 min"), R("facepull", 2, 15, 20, 2, "1 min"), R("cablecrunch", 3, 10, 15, 1, "1 min")] },
        { name: "Full C", focus: "Mixed, higher reps", ex: [R("legext", 3, 10, 15, 1, "1-2 min"), R("hipthrust", 3, 8, 12, 2, "2 min"), R("cablefly", 3, 10, 15, 1, "1-2 min"), R("cablerow", 3, 10, 12, 2, "2 min"), R("pulldown", 2, 8, 12, 2, "2 min"), R("pushdown", 3, 10, 15, 1, "1-2 min"), R("hammercurl", 3, 10, 15, 1, "1-2 min"), R("seatedcalf", 3, 12, 15, 1, "1-2 min")] }
      ]
    }
  };

  const JOINTS = [["shoulder", "Shoulder"], ["elbow", "Elbow"], ["wrist", "Wrist"], ["lowback", "Lower back"], ["hip", "Hip"], ["knee", "Knee"], ["ankle", "Ankle / Achilles"]];

  const PRINCIPLES = [
    ["Hard sets, not junk volume", "Most growth comes from sets taken within about 0 to 3 reps of failure, in the 5 to 30 rep range, with the load actually progressing. Aim for roughly 10 to 16 hard sets per muscle per week and stay in that range unless progress stalls."],
    ["Progressive overload (double progression)", "Stay at a weight until every set reaches the top of the rep range with 2 or fewer reps in reserve, then add the smallest load jump. The hub calculates this for you from your log."],
    ["Stretch under load", "Full range of motion, with extra emphasis on the lengthened position (deep leg press, incline curl, overhead triceps, Romanian deadlift), is consistently good for growth and keeps joints moving through their full range."],
    ["Control the way down", "About 2 seconds lowering, no bouncing at the bottom of presses or squats. Most tendon and joint trouble comes from fast loading in end ranges."],
    ["Ramp up, never spike", "Muscle adapts faster than tendons and bone. Raise weekly volume gradually (rule of thumb: no more than about 10 to 20% a week) and be most careful after a break or a long illness, which is exactly your situation."],
    ["RIR, not ego", "Reps in reserve of 2 on the heavy compounds and 0 to 1 on isolation work is plenty. Going to true failure on big lifts adds fatigue and injury risk for little extra growth."],
    ["Deload on purpose", "Every 5 to 8 weeks, or sooner when the hub shows several red or yellow days, run a week at about half the sets with the same weights, 3+ reps in reserve. You usually come back stronger."],
    ["Sleep and food are training", "7 to 9 hours of sleep, 1.6 to 2.2 g of protein per kg spread over the day, and a modest surplus. In Crohn's, calories are often the hard part, so the recipe tab matters as much as the gym."]
  ];

  const WARMUP = [
    "5 minutes easy cardio (bike, brisk walk), enough to feel warm.",
    "1 to 2 mobility drills for the joints you are about to load (shoulder dislocates or band pull-aparts on upper days, hip hinge and goblet squat on lower days).",
    "Ramp-up sets for the first lift: about 50%, 70%, 85% of the working weight for 5, 3, 1 reps. Later exercises need just one light set.",
    "Stop adding load if a set feels sharp, pinching or unstable, regardless of the plan."
  ];

  const PAIN_RULES = [
    "Muscle burn and mild joint awareness up to 3/10 that settles within 24 hours is generally acceptable.",
    "Pain of 4 to 6/10, or pain that is still there the next morning, means: swap to the suggested alternative, lower the load, and re-check in a week.",
    "7/10 or more, sharp or catching pain, swelling, numbness or tingling, night pain, or a pop followed by weakness: stop training that area and get it examined.",
    "Tendon pain (front of the knee, Achilles, elbows, shoulder front) often warms up and fades during a session but is worse next morning. Treat it as a load problem even when it feels fine mid-session.",
    "For pain relief prefer paracetamol, heat and relative rest. Regular NSAIDs (ibuprofen, diclofenac, naproxen, ketoprofen) can irritate the gut and are generally avoided in Crohn's. Check with your IBD team before using them."
  ];

  const CROHN_TRAIN = [
    ["Training is good for Crohn's", "Moderate regular exercise is considered safe in IBD and is linked with better mood, bone health and quality of life. Resistance training also counters the muscle loss that is common in Crohn's, which is directly your goal."],
    ["If you have had steroids: go slower on tendons and bones", "Steroid courses can weaken tendon, muscle and bone, and the effect lingers. That is a reason for a gradual ramp, and for asking your doctor whether a bone density scan (DEXA) makes sense. Calcium, vitamin D, protein and heavy-ish loaded exercise all help."],
    ["Fluoroquinolone antibiotics and tendons", "Ciprofloxacin, levofloxacin and similar antibiotics carry a known tendon rupture warning, with higher risk after steroids. If one is ever prescribed, mention any steroid history and your training, and stop and call if a tendon (especially the Achilles) becomes painful."],
    ["Immunosuppressants and biologics: infections and sun", "If you take azathioprine, steroids or a biologic such as infliximab, fever or a proper infection is a reason to skip training until recovered. Avoid live vaccines (inactivated ones are fine) and protect your skin from strong sun when training outdoors, since azathioprine raises skin cancer risk over the years; a yearly skin check is standard advice. Your team monitors blood counts and liver tests for the same reason."],
    ["Fatigue after an infusion", "Some people feel flat for a day or two after a dose. If that is you, schedule the lighter session there and keep the heavy ones for your best days."],
    ["Eating around training", "Avoid a large, fatty or high-fibre meal in the 2 hours before. A small easy carb (white rice, banana, bread if you tolerate it) is usually fine. Train when your bowel is usually quiet, and know where the toilet is."],
    ["Fluids and salts", "Diarrhoea days cost water, sodium and potassium. Drink to thirst, add a pinch of salt or an oral rehydration drink on loose days, and take extra care in the heat."],
    ["Bracing and heavy lifts", "If your imaging shows no strictures, fistulas or abscess, normal bracing and heavy lifting are generally not a problem for the bowel. That changes after bowel surgery or with perianal disease; ask your team first."],
    ["Creatine", "Creatine monohydrate (3 to 5 g a day, with food) is well studied and generally safe. Data in IBD are limited, and big doses can loosen stools. It raises blood creatinine without harming the kidneys, so tell whoever reads your labs, and consider cystatin C if kidney function is ever in doubt."]
  ];

  const RED_FLAGS = [
    "Blood in the stool, black stools, or a clear rise in stool frequency over several days.",
    "Fever, persistent night sweats, or unexplained weight loss.",
    "Severe or worsening abdominal pain, repeated vomiting, a swollen belly, or no stool and no gas.",
    "Pain, swelling or pus near the anus, or a new draining opening.",
    "Swollen lymph nodes that stay, or a mole or skin lesion that changes.",
    "Any of the above on immunosuppression is worth a same-week call to your IBD team. Do not wait for a pattern in this hub."
  ];

  // Generic adult reference intervals. Labs differ: always trust the range printed on your own result.
  const LABS = {
    crp: { n: "CRP", u: "mg/L", lo: 0, hi: 5, why: "Blood marker of inflammation. Normal CRP does not exclude active Crohn's, but a high one with symptoms points to a flare or infection." },
    calpro: { n: "Faecal calprotectin", u: "µg/g", lo: 0, hi: 150, why: "Best non-invasive marker of gut inflammation. Under about 150 is a commonly used treatment target; rising values often come before symptoms." },
    ferritin: { n: "Ferritin", u: "µg/L", lo: 30, hi: 400, why: "Iron stores. In active inflammation ferritin runs high, so under about 100 can still mean low iron. Low iron blunts endurance and recovery." },
    hb: { n: "Haemoglobin", u: "g/L", lo: 135, hi: 175, why: "Anaemia is common in Crohn's (blood loss, iron, B12 or folate lack). Affects energy and training quality." },
    b12: { n: "Vitamin B12", u: "pg/mL", lo: 200, hi: 900, why: "Absorbed in the terminal ileum. Worth checking yearly in Crohn's, especially with any ileal involvement or surgery." },
    vitd: { n: "Vitamin D (25-OH)", u: "nmol/L", lo: 50, hi: 150, why: "Bone and muscle function. Many IBD clinicians aim for 75+ nmol/L, particularly after steroid exposure." },
    folate: { n: "Folate", u: "ng/mL", lo: 3, hi: 17, why: "Can be low in Crohn's or on some drugs. Low folate adds to anaemia and fatigue." },
    albumin: { n: "Albumin", u: "g/L", lo: 35, hi: 50, why: "Falls with inflammation and poor nutrition. A useful general marker of how you are doing." },
    zinc: { n: "Zinc", u: "µmol/L", lo: 11, hi: 24, why: "Lost with diarrhoea; matters for immunity and recovery." },
    alt: { n: "ALT", u: "U/L", lo: 0, hi: 50, why: "Liver enzyme monitored on azathioprine. Alcohol and heavy training can raise it slightly." },
    ast: { n: "AST", u: "U/L", lo: 0, hi: 40, why: "Liver enzyme; also rises transiently after hard training, so avoid testing right after a heavy session." },
    wbc: { n: "White cells (WBC)", u: "x10^9/L", lo: 4, hi: 10, why: "Monitored on azathioprine. A drop raises infection risk." },
    lymph: { n: "Lymphocytes", u: "x10^9/L", lo: 1, hi: 4, why: "Azathioprine lowers them; your team uses this to judge the dose." },
    neut: { n: "Neutrophils", u: "x10^9/L", lo: 2, hi: 7.5, why: "Key infection-fighting cells, monitored on azathioprine." },
    creat: { n: "Creatinine", u: "µmol/L", lo: 60, hi: 110, why: "Kidney marker. Muscle mass and creatine supplements raise it without kidney damage." },
    ifx: { n: "Infliximab trough", u: "µg/mL", lo: 5, hi: 10, why: "Drug level before the next infusion. Levels of about 5+ are commonly aimed for in Crohn's; low levels or antibodies can explain a loss of response." },
    tgn: { n: "6-TGN (azathioprine)", u: "pmol/8x10^8 RBC", lo: 235, hi: 450, why: "Active thiopurine metabolite; checked by some centres to tune the dose." },
    mcv: { n: "MCV", u: "fL", lo: 80, hi: 98, why: "Average red-cell size. It rises on azathioprine (a sign it is working and being taken), and also with low B12 or folate." },
    plt: { n: "Platelets", u: "x10^9/L", lo: 150, hi: 400, why: "Often raised during active inflammation; can fall on azathioprine." },
    k: { n: "Potassium", u: "mmol/L", lo: 3.5, hi: 5.1, why: "Lost with diarrhoea; low levels cause cramps and weakness in training." },
    mg: { n: "Magnesium", u: "mmol/L", lo: 0.7, hi: 1.05, why: "Lost with diarrhoea; low levels cause cramps and poor sleep." },
    ca: { n: "Calcium", u: "mmol/L", lo: 2.15, hi: 2.55, why: "Bone health marker; relevant after steroid exposure." },
    glucose: { n: "Glucose (fasting)", u: "mmol/L", lo: 3.9, hi: 5.6, why: "Steroids can raise blood sugar; useful to follow after a course." },
    tsh: { n: "TSH", u: "mIU/L", lo: 0.4, hi: 4.0, why: "Thyroid screen. Thyroid problems are more common with autoimmune conditions and affect energy and weight." },
    ft4: { n: "Free T4", u: "pmol/L", lo: 12, hi: 22, why: "Thyroid hormone, read together with TSH." },
    testo: { n: "Testosterone (total)", u: "nmol/L", lo: 8.6, hi: 29, why: "Illness, weight loss and steroids can suppress it. Interpret with your lab's age range, ideally from a morning sample." },
    cortisol: { n: "Cortisol (morning)", u: "nmol/L", lo: 140, hi: 690, why: "After a steroid course the body's own cortisol can be low for a while. Only a morning sample is comparable." },
    ldl: { n: "LDL cholesterol", u: "mmol/L", lo: 0, hi: 3, why: "Cardiovascular marker, mostly relevant if you take steroids long term." }
  };

  return { MUSCLES, EX, PROGRAMS, JOINTS, PRINCIPLES, WARMUP, PAIN_RULES, CROHN_TRAIN, RED_FLAGS, LABS };
})();
