const officeTasks = ["requests", "folders", "forms", "notices", "records", "receipts", "permits", "certificates"];
const surnames = ["Abad", "Aguilar", "Aquino", "Bautista", "Cabrera", "Cruz", "Flores", "Garcia", "Lim", "Mendoza", "Ramos", "Reyes", "Santos", "Tan", "Torres", "Villanueva"];

export function makeNumerical() {
  const items = [];
  for (let i = 0; i < 24; i += 1) {
    const a = 8 + i;
    const b = 3 + (i % 6);
    const noun = officeTasks[i % officeTasks.length];
    const total = (a + b) * 20;
    const percent = Math.round(100 * b / (a + b));
    items.push(
      ["Order of operations", `What is ${a} + ${b} × 4 − 3?`, a + b * 4 - 3, (a + b) * 4 - 3, a + b * 4 + 3, (a + b) * 4 + 3, `Multiply first: ${b} × 4 = ${b * 4}. Then add ${a} and subtract 3.`],
      ["Percentages", `Of ${total} ${noun}, ${b * 20} are pending. What percentage is pending, to the nearest whole percent?`, `${percent}%`, `${percent + 5}%`, `${percent - 5}%`, `${100 - percent}%`, `Divide ${b * 20} by ${total}, multiply by 100, and round.`],
      ["Ratios", `Two branches split ${(b + 2) * a} ${noun} in a 2 to ${b} ratio. How many go to the smaller branch?`, a * 2, a * b, a, a * (b + 1), `There are ${b + 2} equal parts, so each part is ${a}. The smaller branch gets 2 parts.`],
      ["Number sequences", `What comes next? ${a}, ${a + b}, ${a + 2 * b + 1}, ${a + 3 * b + 3}, ___`, a + 4 * b + 6, a + 4 * b + 5, a + 4 * b + 3, a + 4 * b + 7, `The successive differences are ${b}, ${b + 1}, and ${b + 2}. Add ${b + 3} next.`],
      ["Rates", `One clerk processes ${a * 3} ${noun} in 3 hours at a constant rate. How many can two equally fast clerks process in ${b} hours?`, a * 2 * b, a * b, a * 3 * b, a * 2 + b, `One clerk handles ${a} per hour. Multiply by 2 clerks and ${b} hours.`],
      ["Fractions", `An office uses 1/4 of a ₱${a * 120} budget for supplies and 1/3 for repairs. How much remains?`, `₱${a * 50}`, `₱${a * 70}`, `₱${a * 30}`, `₱${a * 80}`, `The office spends 3/12 + 4/12 = 7/12, leaving 5/12 of ₱${a * 120}.`],
      ["Averages", `A counter processed ${a}, ${a + 6}, and ${a + 12} ${noun} over three days. How many must it process on day four to average ${a + 9} per day?`, a + 18, a + 9, a + 15, a + 21, `Four days need ${4 * (a + 9)} in total. Subtract the first three days' ${3 * a + 18}.`],
      ["Decimals", `A print shop charges ₱${b}.50 per copy. How much does an order of ${a} copies cost before fees?`, `₱${(a * (b + 0.5)).toFixed(2)}`, `₱${(a * b + 0.5).toFixed(2)}`, `₱${(a * (b + 0.25)).toFixed(2)}`, `₱${(a * (b + 1)).toFixed(2)}`, `Multiply the full unit price, ₱${b}.50, by ${a}.`],
    );
  }
  return items;
}

const analogies = [
  ["Scissors are to cutting as a ruler is to _____.", "measuring", "gluing", "folding", "weighing", "The first word is a tool and the second is its main function."],
  ["A chapter is to a book as a scene is to a _____.", "play", "stage", "actor", "ticket", "A chapter is a division of a book, and a scene is a division of a play."],
  ["A key is to a lock as a password is to a _____.", "protected account", "printed receipt", "storage box", "filing label", "Both pairs show a means of gaining access to what it opens."],
  ["A thermometer is to temperature as a scale is to _____.", "weight", "length", "duration", "direction", "Both tools measure a specific quantity."],
  ["Editing is to a draft as proofreading is to _____.", "a text being checked for errors", "an appointment being confirmed", "a bill being paid", "a room being arranged", "Both pairs identify a process and the material being worked on."],
  ["Seed is to plant as egg is to _____.", "chick", "shell", "nest", "feather", "The first item can develop into the second."],
  ["An index is to a book as a directory is to _____.", "a list of contacts", "a postage stamp", "an office chair", "a blank form", "Both organize information to help people locate entries."],
  ["A librarian is to a library as a curator is to a _____.", "museum", "warehouse", "station", "courtroom", "The relationship is a worker and their typical place of work."],
  ["Wrist is to hand as ankle is to _____.", "foot", "knee", "shoulder", "elbow", "The joint connects the corresponding extremity to a limb."],
  ["A roof is to a house as a lid is to a _____.", "container", "label", "shelf", "handle", "A roof covers the top of a house. A lid covers the top of a container."],
];

export function makeAnalytical() {
  const items = analogies.map((item) => ["Analogies", ...item]);
  for (let i = 0; i < 18; i += 1) {
    const noun = officeTasks[i % officeTasks.length];
    const old = 24 + 3 * i;
    const change = 4 + i;
    const first = surnames[i % 12];
    const middle = surnames[i % 12 + 1];
    const last = surnames[i % 12 + 2];
    const fourth = surnames[i % 12 + 3 + Math.floor(i / 12)];
    items.push(
      ["Data interpretation", `The office processed ${old} ${noun} in April, ${old + change} in May, and ${old + change * 3} in June. How much greater was the May–June increase than the April–May increase?`, change, change * 2, change * 3, old, `The first increase was ${change}. The second was ${2 * change}. Their difference is ${change}.`],
      ["Symbolic logic", `For this item, x ◆ y means 2x − y, and x ● y means x + 2y. What is (${i + 5} ◆ 3) ● 4?`, 2 * (i + 5) + 5, 2 * (i + 5) + 1, 2 * (i + 5) + 11, 2 * (i + 5) - 11, `The first operation gives ${2 * (i + 5) - 3}. Then add 2 × 4.`],
      ["Drawing conclusions", `Four applicants have distinct appointment times. ${first} is earlier than ${middle}. ${last} is later than ${middle}. ${fourth} is later than ${first} but earlier than ${middle}. Who is second?`, fourth, first, middle, last, `The order must be ${first}, ${fourth}, ${middle}, then ${last}.`],
    );
  }
  const assumptions = [
    ["An office proposes moving forms online to reduce trips to its counter. Which assumption is required for the change to reduce trips?", "Some applicants can submit the forms remotely.", "Every applicant owns a computer.", "The counter will close permanently.", "All applications will be approved.", "At least some submissions must be possible remotely to replace a trip."],
    ["A committee wants to send appointment reminders by SMS to reduce missed visits. Which assumption is necessary?", "At least some people can receive the SMS before their appointments.", "Everyone will reply to the message.", "All appointments are scheduled in the morning.", "Messages must be sent from a personal phone.", "A reminder can influence attendance only if some recipients can receive it in time."],
    ["The supervisor proposes a second counter during peak hours to reduce the queue. Which assumption supports the plan?", "The second counter can process some of the same transactions.", "The first counter will stop serving clients.", "The office will raise every processing fee.", "All clients will choose the second counter.", "Adding capacity reduces a queue when the extra counter can serve waiting clients."],
    ["A survey found that respondents at one branch prefer online booking. What must be established before generalizing the result to all branches?", "The respondents adequately represent users of all branches.", "The first branch opened earlier than the others.", "Every respondent chose the same answer.", "The survey was answered using a desktop computer.", "A sample must represent the broader population to support that generalization."],
    ["A report claims signs will prevent visitors from going to the wrong room. What must be true for the signs to help?", "Visitors can notice and understand the signs.", "The office has only one room.", "All visitors have already memorized the layout.", "The signs contain only staff names.", "The intended readers need to see and understand the directions."],
    ["Every authorized reviewer has completed orientation. Lina has not completed orientation. What follows?", "Lina is not an authorized reviewer.", "Lina is an authorized reviewer.", "Nobody has completed orientation.", "Everyone who completes orientation is a reviewer.", "Completing orientation is necessary for authorization. Without orientation, authorization is ruled out."],
    ["All archived cases have a reference number. Some appeals are archived cases. What can be concluded?", "Some appeals have a reference number.", "All appeals are archived.", "Every numbered case is an appeal.", "No appeals have a reference number.", "The appeals in the archived group must share its property of having a reference number."],
    ["No temporary badges allow access to the records room. A badge allows access to the records room. What follows?", "The badge is not temporary.", "The badge is temporary.", "No badges are temporary.", "Every permanent badge grants access.", "The badge's access rules out membership in the temporary category."],
  ];
  return items.concat(assumptions.map((item) => ["Assumptions and conclusions", ...item]));
}

const spellings = [
  ["accommodate", "acommodate", "accomodate", "acomodate"],
  ["acknowledgment", "acknowledgemant", "acknowledgmant", "aknowledgment"],
  ["address", "adress", "addres", "adddress"],
  ["amendment", "ammendment", "amendmant", "ammandment"],
  ["apparent", "aparent", "apparant", "apperent"],
  ["appointment", "apointment", "appoinment", "appointmant"],
  ["attendance", "attendence", "atendance", "attandance"],
  ["authority", "autority", "authorithy", "authorety"],
  ["auxiliary", "auxilliary", "auxilary", "auxilairy"],
  ["calendar", "calenndar", "callendar", "calandar"],
  ["certificate", "certifficate", "certifecate", "cirtificate"],
  ["commission", "commision", "comission", "commisson"],
  ["committee", "comittee", "commitee", "comitee"],
  ["conscientious", "concientious", "consciencious", "consientious"],
  ["correspondence", "correspondance", "corespondence", "corresponddence"],
  ["definitely", "definately", "definitly", "deffinitely"],
  ["discipline", "dicipline", "disipline", "disciplene"],
  ["eligible", "eligable", "ellegible", "elligible"],
  ["environment", "enviroment", "envirenment", "environmant"],
  ["exaggerate", "exagerate", "exagerrate", "exaggarate"],
  ["experience", "experiance", "expeirence", "experrience"],
  ["familiar", "familliar", "familar", "familier"],
  ["government", "goverment", "governmant", "governnment"],
  ["independent", "independant", "independet", "indepandent"],
  ["maintenance", "maintainance", "maintenence", "maintanance"],
  ["miscellaneous", "miscellanous", "miscelaneous", "miscellenous"],
  ["necessary", "neccessary", "necessery", "necesary"],
  ["occurrence", "occurence", "ocurrence", "occurance"],
  ["personnel", "personel", "personnell", "perssonel"],
  ["privilege", "priviledge", "privelege", "privilage"],
  ["procedure", "procedurre", "proceduer", "proceedure"],
  ["receipt", "reciept", "receept", "recipt"],
  ["recommend", "reccommend", "recomend", "reccomend"],
  ["reference", "referance", "refferrence", "referense"],
  ["schedule", "scheduel", "scedule", "schedulle"],
  ["separate", "seperate", "separete", "sepparate"],
  ["signature", "signiture", "siganture", "siggnature"],
  ["successful", "succesful", "successfull", "sucessful"],
  ["threshold", "threshhold", "threashold", "thresold"],
  ["vacancy", "vacency", "vancancy", "vaccancy"],
];

export function makeClerical() {
  const items = spellings.map(([correct, ...distractors]) => [
    "Spelling", "Which spelling is correct?",
    correct, ...distractors, `The correct spelling is “${correct}”.`,
  ]);
  for (let i = 0; i < surnames.length - 3; i += 1) {
    const [a, b, c, d] = surnames.slice(i, i + 4);
    items.push(
      ["Alphabetical filing", `Arrange these surnames in A–Z filing order: ${d}, ${b}, ${a}, ${c}.`, `${a}, ${b}, ${c}, ${d}`, `${a}, ${c}, ${b}, ${d}`, `${b}, ${a}, ${c}, ${d}`, `${d}, ${c}, ${b}, ${a}`, "Compare surnames from the first letter and proceed to the first differing letter."],
      ["Alphabetical filing", `Which record appears third when filed by surname, then by given name? ${b}, Mila / ${b}, Aaron / ${a}, Zoe / ${d}, Nina.`, `${b}, Mila`, `${b}, Aaron`, `${a}, Zoe`, `${d}, Nina`, `${a} comes first. Within ${b}, Aaron comes before Mila. ${d} comes last.`],
      ["Numerical filing", `Files are sorted by the numeric portion of the code. Which comes immediately after R-${i + 100} among R-${i + 110}, R-${i + 103}, R-${i + 99}, and R-${i + 105}?`, `R-${i + 103}`, `R-${i + 105}`, `R-${i + 99}`, `R-${i + 110}`, `The next file uses the smallest number greater than ${i + 100}.`],
    );
  }
  return items;
}
