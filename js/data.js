/* =========================================================================
   GOVT. BOYS MODEL HIGH SCHOOL, LAYYAH
   Principal's Monitoring Console — data definitions
   Source: CamScanner 25-11-2026 10.43.pdf (3 pages)
     Page 1  Daily monitoring checklist (weighted rubric, 15 items)
     Page 2  Incharge-wise sheet: 29 teachers, class, enrollment, 4 weeks
             of Assembly % / Class % attendance
     Page 3  Daily assembly register, EMIS 32230016 (class enrollment)
   ========================================================================= */

export const SCHOOL = {
  name: 'GOVT. BOYS MODEL HIGH SCHOOL, LAYYAH',
  shortName: 'GBMHS Layyah',
  emis: '32230016',
  principal: 'Dr. Rizwan Alam',
  principalTitle: 'Principal',
  district: 'Layyah, Punjab',
  session: 'Academic Session 2026–27',
  monitorPeriod: '01 October 2026 — 30 October 2026',
};

/* -------------------------------------------------------------------------
   The 15 rubric items exactly as printed on page 1 of the checklist.
   `pillar` maps each item to one of the four weighted pillars.
   `options` are the printed scoring options.
   ------------------------------------------------------------------------- */
export const PILLARS = {
  attendance: { key: 'attendance', name: 'Attendance & Punctuality', short: 'Attendance', weight: 0.35, color: '#0b6b4f' },
  classroom: { key: 'classroom', name: 'Classroom & Teaching Quality', short: 'Classroom', weight: 0.30, color: '#1d4e89' },
  compliance: { key: 'compliance', name: 'Compliance & Records', short: 'Compliance', weight: 0.20, color: '#8a5a12' },
  activities: { key: 'activities', name: 'Activities & Engagement', short: 'Activities', weight: 0.15, color: '#7a2f4f' },
};

export const ITEMS = [
  {
    key: 'attendance', ur: 'حاضری طلباء', en: 'Student Attendance',
    pillar: 'attendance', max: 2, icon: 'users',
    hint: 'Percentage of students present in the class on the day.',
    options: [
      { pts: 0, label: 'Below 80%' },
      { pts: 1, label: '80% and above' },
      { pts: 2, label: '90% and above' },
    ],
    remedy: 'Run a same-day absentees call-back. Mark the class register before the first period and report the 10 absentees by name to the office daily.',
  },
  {
    key: 'uniform', ur: 'مکمل یونیفارم', en: 'Complete Uniform',
    pillar: 'compliance', max: 3, icon: 'shirt',
    hint: 'Students in complete uniform (shirt, trousers, shoes, sweater in winter).',
    options: [
      { pts: 0, label: 'Below 70%' },
      { pts: 1, label: '70% and above' },
      { pts: 2, label: '80% and above' },
      { pts: 3, label: '90% and above' },
    ],
    remedy: 'Hold a uniform check at the assembly line. Identify defaulters by roll number and write to parents; keep a class uniform register.',
  },
  {
    key: 'personal_file', ur: 'ذاتی فائل', en: 'Personal File',
    pillar: 'classroom', max: 1, icon: 'folder',
    hint: 'Teacher\u2019s own personal file maintained and up to date.',
    options: [
      { pts: 0, label: 'Incomplete / not shown' },
      { pts: 1, label: 'Complete' },
    ],
    remedy: 'Personal file is incomplete. Ask the teacher to submit service record, CNIC, academic certificates and training record in one indexed file within 3 days.',
  },
  {
    key: 'training_card', ur: 'ٹریننگ کارڈ', en: 'Training Card',
    pillar: 'compliance', max: 1, icon: 'badge',
    hint: 'Training card produced (7th & 8th grade / shoe item as printed).',
    options: [
      { pts: 0, label: 'Not produced' },
      { pts: 1, label: 'Produced' },
    ],
    remedy: 'Training card not produced. Verify the teacher\u2019s latest training entry with the DEO office and get the card updated.',
  },
  {
    key: 'zamaat_file', ur: 'رضا کار فائل', en: 'Class / Zamaat File',
    pillar: 'classroom', max: 5, icon: 'book',
    hint: 'Class file completeness — registers, results, parent contacts, co-curricular record.',
    options: [
      { pts: 0, label: 'Below 90%' },
      { pts: 2, label: '90% complete' },
      { pts: 5, label: '100% complete' },
    ],
    remedy: 'Class file is below standard. Rebuild the index: attendance register, result sheets, parent contact list, and co-curricular record must all be present.',
  },
  {
    key: 'assembly_photo', ur: 'اسمبلی تصویر حاضری', en: 'Assembly Photo',
    pillar: 'activities', max: 1, icon: 'camera',
    hint: 'Photograph of the class at morning assembly submitted.',
    options: [
      { pts: 0, label: 'Not submitted' },
      { pts: 1, label: 'Submitted' },
    ],
    remedy: 'Assembly photograph not submitted. Class incharges must send the assembly line photo to the school WhatsApp group before 8:15 am.',
  },
  {
    key: 'extra_activity', ur: 'اضافی سرگرمی', en: 'Extra Activity',
    pillar: 'activities', max: 1, icon: 'spark',
    hint: 'One extra co-curricular activity conducted with the class.',
    options: [
      { pts: 0, label: 'Not conducted' },
      { pts: 1, label: 'Conducted' },
    ],
    remedy: 'No extra activity recorded. Schedule one 20-minute activity per week — speech, quiz, calligraphy or plantation drive — and photograph it.',
  },
  {
    key: 'classroom', ur: 'کلاس روم فیچرز', en: 'Classroom Features',
    pillar: 'classroom', max: 5, icon: 'board', monthly: true,
    hint: 'Monthly classroom features: display boards, seating plan, cleanliness, lighting, learning corner.',
    options: [
      { pts: 0, label: '0 features' },
      { pts: 1, label: '1 feature' },
      { pts: 2, label: '2 features' },
      { pts: 3, label: '3 features' },
      { pts: 4, label: '4 features' },
      { pts: 5, label: '5 features' },
    ],
    remedy: 'Classroom features are thin. Target the five printed features — display board, seating plan, cleanliness, lighting and learning corner — add one per week.',
  },
  {
    key: 'transport', ur: 'ٹرانسپورٹ', en: 'Transport',
    pillar: 'activities', max: 3, icon: 'bus',
    hint: 'Students availing school transport: 1–5 = 1 pt/student, 6–10 = 2, 11+ = 3.',
    options: [
      { pts: 0, label: 'None availing' },
      { pts: 1, label: '1–5 students' },
      { pts: 2, label: '6–10 students' },
      { pts: 3, label: '11 or more' },
    ],
    remedy: 'Very few students on the transport route. Publicise the bus route and stops at the next parent meeting.',
  },
  {
    key: 'leave', ur: 'رخصت', en: 'Leave',
    pillar: 'attendance', max: 2, icon: 'calendar', monthly: true,
    hint: 'Teacher leave in the month.',
    options: [
      { pts: 0, label: 'Two or more leaves' },
      { pts: 1, label: 'One leave' },
      { pts: 2, label: 'No leave' },
    ],
    remedy: 'Leave is above the permitted level. Discuss the pattern, confirm whether leave was sanctioned, and arrange a substitute period plan.',
  },
  {
    key: 'daily_dress', ur: 'روزانہ ڈریس', en: 'Daily Dress',
    pillar: 'attendance', max: 2, icon: 'tie',
    hint: 'Teacher present in proper dress code.',
    options: [
      { pts: 0, label: 'Not in dress' },
      { pts: 1, label: 'Partly' },
      { pts: 2, label: 'Full dress code' },
    ],
    remedy: 'Dress code not followed on the day checked. Remind the teacher of the notification on prescribed dress for teaching staff.',
  },
  {
    key: 'donation', ur: 'ماہانہ چندہ', en: 'Monthly Donation',
    pillar: 'compliance', max: 10, icon: 'coin', monthly: true,
    hint: 'Monthly donation collected by the class incharge (Rs.).',
    options: [
      { pts: 0, label: 'Nil' },
      { pts: 1, label: 'Rs. 1,000' },
      { pts: 5, label: 'Rs. 5,000' },
      { pts: 10, label: 'Rs. 10,000' },
    ],
    remedy: 'Monthly donation collection is low. Check whether the class fund register is being issued receipts, and follow up with the parents\u2019 council.',
  },
  {
    key: 'lesson_plan', ur: 'لیسن پلان', en: 'Lesson Plan',
    pillar: 'classroom', max: 1, icon: 'note',
    hint: 'Weekly lesson plan submitted.',
    options: [
      { pts: 0, label: 'Not submitted' },
      { pts: 1, label: 'Submitted (weekly)' },
    ],
    remedy: 'Weekly lesson plan missing. Enforce Monday submission for the coming week, signed by the class incharge and countersigned by the office.',
  },
  {
    key: 'scout', ur: 'سکاؤٹ یونیفارم', en: 'Scout Uniform',
    pillar: 'activities', max: 10, icon: 'flag',
    hint: 'Scout students in uniform — 2 points per 5 scouts.',
    options: [
      { pts: 0, label: '0 scouts' },
      { pts: 2, label: '5 scouts' },
      { pts: 4, label: '10 scouts' },
      { pts: 6, label: '15 scouts' },
      { pts: 8, label: '20 scouts' },
      { pts: 10, label: '25 scouts' },
    ],
    remedy: 'Scout contingent is short. Nominate students at the next assembly and draw uniform from the store.',
  },
  {
    key: 'social_media', ur: 'Activity on Social Media', en: 'Activity on Social Media',
    pillar: 'activities', max: 1, icon: 'share',
    hint: 'Weekly post of class activity on the school social media page.',
    options: [
      { pts: 0, label: 'Not posted' },
      { pts: 1, label: 'Posted (weekly)' },
    ],
    remedy: 'No social media activity for the week. Send two photographs and a short write-up of class work to the school media focal person.',
  },
];

export const ITEM_BY_KEY = Object.fromEntries(ITEMS.map((i) => [i.key, i]));
export const MAX_TOTAL = ITEMS.reduce((s, i) => s + i.max, 0);
export const PILLAR_ITEMS = Object.keys(PILLARS).reduce((acc, k) => {
  acc[k] = ITEMS.filter((i) => i.pillar === k);
  return acc;
}, {});
export const PILLAR_MAX = Object.keys(PILLARS).reduce((acc, k) => {
  acc[k] = PILLAR_ITEMS[k].reduce((s, i) => s + i.max, 0);
  return acc;
}, {});

/* -------------------------------------------------------------------------
   29 staff, transcribed from page 2 (incharge-wise sheet).
   `classes` / `enrollment` from page 3 (assembly register).
   `est` marks enrollment figures taken from the neighbouring section
   because the class did not appear on the printed register.
   ------------------------------------------------------------------------- */
export const SEED_TEACHERS = [
  { sr: 1, name: 'Mr. Ghulam Yasin', designation: 'SST (Science)', cls: '10th-A', enrollment: 46, profile: 'strong' },
  { sr: 2, name: 'Mr. Wahid Bakhsh', designation: 'SST (General)', cls: '10th-B', enrollment: 58, profile: 'average' },
  { sr: 3, name: 'Mr. Rehmat Ullah', designation: 'SST (Science)', cls: '10th-C', enrollment: 55, profile: 'average' },
  { sr: 4, name: 'Mr. Bashir Hussain', designation: 'SST (Science)', cls: '10th-D', enrollment: 48, profile: 'strong' },
  { sr: 5, name: 'Mr. Abdul Sami Qamar', designation: 'SST (Science)', cls: '10th-E', enrollment: 58, profile: 'average' },
  { sr: 6, name: 'Mr. Ishtiaq Rasool', designation: 'SST (General)', cls: '10th-Tech', enrollment: 25, profile: 'weak' },
  { sr: 7, name: 'Siraj Ahmad', designation: 'SST (Science)', cls: '9th-A', enrollment: 55, profile: 'strong' },
  { sr: 8, name: 'Mr. Ghulam Abbas', designation: 'SST (General)', cls: '9th-B', enrollment: 52, est: true, profile: 'average' },
  { sr: 9, name: 'Mr. M. Tahir Khan', designation: 'SST (I.Sc)', cls: '9th-C', enrollment: 42, profile: 'average' },
  { sr: 10, name: 'Mr. Atiq ul Zaman', designation: 'SST (Science)', cls: '9th-D', enrollment: 53, est: true, profile: 'weak' },
  { sr: 11, name: 'Mr. Mumtaz Ahmad', designation: 'SST (Science)', cls: '9th-E', enrollment: 55, profile: 'strong' },
  { sr: 12, name: 'Mr. Muhammad Ramzan', designation: 'SST (Science)', cls: '9th-G', enrollment: 60, profile: 'average' },
  { sr: 13, name: 'Muhammad Umar Ali', designation: 'SST (Tech)', cls: '9th-F (Tech)', enrollment: 25, profile: 'weak' },
  { sr: 14, name: 'Ghulam Shabir', designation: 'Teacher', cls: '8th-A', enrollment: 37, profile: 'average' },
  { sr: 15, name: 'Mr. Mudassar Iqbal', designation: 'EST (Science)', cls: '8th-B', enrollment: 30, profile: 'strong' },
  { sr: 16, name: 'Mr. Muhammad Ashraf', designation: 'EST (General)', cls: '8th-C', enrollment: 47, profile: 'average' },
  { sr: 17, name: 'Mr. Jamshaid Hassan', designation: 'EST (Science)', cls: '8th-D', enrollment: 47, profile: 'average' },
  { sr: 18, name: 'Mr. Asad Abbas', designation: 'PST (Science)', cls: '7th-A', enrollment: 28, profile: 'strong' },
  { sr: 19, name: 'Mr. Rafiq Ahmad Bhutta', designation: 'EST (General)', cls: '7th-B', enrollment: 42, profile: 'average' },
  { sr: 20, name: 'Mr. Irshad Hussain', designation: 'EST', cls: '7th-C', enrollment: 28, profile: 'weak' },
  { sr: 21, name: 'Mr. Hasnain', designation: 'EST (Science)', cls: '7th-D', enrollment: 48, profile: 'average' },
  { sr: 22, name: 'Mr. M. Irfan Gul', designation: 'EST (General)', cls: '6th-A', enrollment: 35, profile: 'average' },
  { sr: 23, name: 'Mr. M. Zafar Iqbal', designation: 'EST (General)', cls: '6th-B', enrollment: 15, profile: 'strong' },
  { sr: 24, name: 'Mr. Muhammad Asif', designation: 'EST (Science)', cls: '6th-C', enrollment: 43, profile: 'weak' },
  { sr: 25, name: 'Mr. Sajjad Iqbal', designation: 'EST (General)', cls: '6th-D', enrollment: 33, profile: 'average' },
  { sr: 26, name: 'Muhammad Mudasir', designation: 'PST (Science)', cls: '5th', enrollment: 21, profile: 'strong' },
  { sr: 27, name: 'Mr. Akhtar Hussain', designation: 'PST', cls: '3rd & 4th', enrollment: 26, profile: 'average' },
  { sr: 28, name: 'Ms. Samina Nazar', designation: 'PST (Science)', cls: '1st & 2nd', enrollment: 35, profile: 'strong' },
  { sr: 29, name: 'Miss Robina Naz', designation: 'Care Giver', cls: 'ECCE & Kachi', enrollment: 35, profile: 'average' },
];

/* 22 working days in October 2026, exactly matching the rows printed on page 1.
   (3 & 4 October are Saturday/Sunday and do not appear on the checklist.) */
export const WORKING_DAYS = [
  '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07',
  '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14',
  '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21',
  '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28',
  '2026-10-29', '2026-10-30',
];

export const WEEKS = [
  { key: 'w1', label: 'Week 1', range: '01–09 Oct', days: WORKING_DAYS.slice(0, 7) },
  { key: 'w2', label: 'Week 2', range: '12–16 Oct', days: WORKING_DAYS.slice(7, 12) },
  { key: 'w3', label: 'Week 3', range: '19–23 Oct', days: WORKING_DAYS.slice(12, 17) },
  { key: 'w4', label: 'Week 4', range: '26–30 Oct', days: WORKING_DAYS.slice(17, 22) },
];

/* Sample class register (page 3) kept separately so the Attendance tab can show
   the printed register exactly as it appears, in both scripts. */
export const ASSEMBLY_REGISTER = [
  { cls: 'ECCE', ur: 'ای سی ای', team: 'ECCE', teacher: 'Robina Naz', enrollment: 22 },
  { cls: 'Kachi', ur: 'کچی', team: 'Kachi', teacher: 'Robina Naz', enrollment: 13 },
  { cls: '1st', ur: 'اول', team: 'One', teacher: 'Samina Nazar', enrollment: 18 },
  { cls: '2nd', ur: 'دوم', team: 'Two', teacher: 'Samina Nazar', enrollment: 17 },
  { cls: '3rd', ur: 'سوم', team: 'Three', teacher: 'Akhtar Hussain', enrollment: 7 },
  { cls: '4th', ur: 'چہارم', team: 'Four', teacher: 'Akhtar Hussain', enrollment: 19 },
  { cls: '5th', ur: 'پنجم', team: 'Five', teacher: 'Muhammad Mudasir', enrollment: 21 },
  { cls: '6th-A', ur: 'ششم-A', team: 'Six-A', teacher: 'Muhammad Irfan Gul', enrollment: 35 },
  { cls: '6th-B', ur: 'ششم-B', team: 'Six-B', teacher: 'Muhammad Zafar Iqbal', enrollment: 15 },
  { cls: '6th-C', ur: 'ششم-C', team: 'Six-C', teacher: 'Muhammad Asif', enrollment: 43 },
  { cls: '6th-D', ur: 'ششم-D', team: 'Six-D', teacher: 'Sajjad Iqbal', enrollment: 33 },
  { cls: '7th-A', ur: 'ہفتم-A', team: 'Seven-A', teacher: 'Asad Abbas', enrollment: 28 },
  { cls: '7th-B', ur: 'ہفتم-B', team: 'Seven-B', teacher: 'Rafiq Ahmad Bhutta', enrollment: 42 },
  { cls: '7th-C', ur: 'ہفتم-C', team: 'Seven-C', teacher: 'Irshad Hussain', enrollment: 28 },
  { cls: '7th-D', ur: 'ہفتم-D', team: 'Seven-D', teacher: 'Hasnain', enrollment: 48 },
  { cls: '8th-A', ur: 'ہشتم-A', team: 'Eight-A', teacher: 'Ghulam Shabir', enrollment: 37 },
  { cls: '8th-B', ur: 'ہشتم-B', team: 'Eight-B', teacher: 'Mudassar Iqbal', enrollment: 30 },
  { cls: '8th-C', ur: 'ہشتم-C', team: 'Eight-C', teacher: 'Muhammad Ashraf', enrollment: 47 },
  { cls: '8th-D', ur: 'ہشتم-D', team: 'Eight-D', teacher: 'Jamshaid Hassan Babar', enrollment: 47 },
  { cls: '9th-A', ur: 'نہم-A', team: 'Nine-A', teacher: 'Siraj Ahmad', enrollment: 55 },
  { cls: '9th-C', ur: 'نہم-C', team: 'Nine-C', teacher: 'Muhammad Tahir Khan', enrollment: 42 },
  { cls: '9th-E', ur: 'نہم-E', team: 'Nine-E', teacher: 'Mumtaz Ahmad', enrollment: 55 },
  { cls: '9th-G', ur: 'نہم-G', team: 'Nine-G', teacher: 'Muhammad Ramzan', enrollment: 60 },
  { cls: '9th-F (Tech)', ur: 'نہم-F (Tech)', team: 'Nine-F (Tech)', teacher: 'Muhammad Umar Ali', enrollment: 25 },
  { cls: '10th-A', ur: 'دہم-A', team: 'Ten-A', teacher: 'Ghulam Yasin', enrollment: 46 },
  { cls: '10th-B', ur: 'دہم-B', team: 'Ten-B', teacher: 'Wahid Bakhsh', enrollment: 58 },
  { cls: '10th-C', ur: 'دہم-C', team: 'Ten-C', teacher: 'Rehmat Ullah', enrollment: 55 },
  { cls: '10th-D', ur: 'دہم-D', team: 'Ten-D', teacher: 'Bashir Hussain', enrollment: 48 },
  { cls: '10th-E', ur: 'دہم-E', team: 'Ten-E', teacher: 'Abdul Sami Qamar', enrollment: 58 },
  { cls: '10th-Tech', ur: 'دہم-Tech', team: 'Ten-Tech', teacher: 'Ishtiaq Rasool', enrollment: 25 },
];
