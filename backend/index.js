import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import chalk from "chalk"; // For color-coded console output
import CostCenterID from "./models/CostCenterID.js";
import AccountID from "./models/AccountID.js";
import Actual from "./models/Actual.js";
import Anticipated from "./models/Anticipated.js";
import ActualsUpload from "./models/ActualsUpload.js";
import AnticipatedsUpload from "./models/AnticipatedsUpload.js";
import multer from 'multer';
import * as XLSX from 'xlsx';

const app = express();
app.use(cors());

// --- Multer Setup for file uploads ---
const upload = multer({ storage: multer.memoryStorage() });

// --- MongoDB Connection ---
//const MONGO_URI = "mongodb+srv://Yoli_M:yqaTQHxnucaEZF0i@marketingdatacluster.ranofpj.mongodb.net/";
const MONGO_URI = "mongodb+srv://Yoli_M:yqaTQHxnucaEZF0i@marketingdatacluster.ranofpj.mongodb.net/";
mongoose.connect(MONGO_URI)
  .then(() => console.log(chalk.green("✅ Successfully connected to MongoDB")))
  .catch(err => console.error(chalk.red("❌ Could not connect to MongoDB:"), err));

// Root route
app.get("/", (req, res) => {
  res.send("Marketing Budget API is running. Access data at /api/budget");
});

// --- Helper: case-insensitive key finder ---
const findValueByKey = (obj, keyToFind) => {
  if (!obj || typeof keyToFind !== "string") return undefined;
  const normalizedKeyToFind = keyToFind.toLowerCase().replace(/\s/g, "");
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const normalizedKey = key.trim().toLowerCase().replace(/\s/g, "");
      if (normalizedKey === normalizedKeyToFind) {
        let value = obj[key];
        // Trim whitespace from the value if it's a string
        if (typeof value === 'string') {
          value = value.trim();
        }
        // If the trimmed value is just a dash, treat it as null (empty)
        if (value === '-') {
          return null;
        }
        return value;
      }
    }
  }
  return undefined;
};

// --- Helper: robust number parser for accounting formats ---
const parseAccountingNumber = (value) => {
  if (value == null) return 0;
  let s = String(value).trim();

  // Remove thousands separators
  s = s.replace(/,/g, '');

  // Handle accounting format for negatives, e.g., (300) -> -300
  if (s.startsWith('(') && s.endsWith(')')) {
    s = '-' + s.substring(1, s.length - 1);
  }
  return Number(s);
};

// --- Helper: Levenshtein distance for fuzzy string matching ---
const levenshtein = (s1, s2) => {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
};

// --- Helper: Normalize data headers ---
const normalizeHeaders = (jsonData, expectedHeaders, corrections) => {
  if (!jsonData || jsonData.length === 0) return jsonData;

  const firstRow = jsonData[0];
  const headerMapping = {};
  const originalHeaders = Object.keys(firstRow);

  for (const originalHeader of originalHeaders) {
    let bestMatch = null;
    let minDistance = Infinity;

    for (const expectedHeader of expectedHeaders) {
      const distance = levenshtein(originalHeader, expectedHeader);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = expectedHeader;
      }
    }

    // If the best match is close enough (e.g., distance <= 2) and different, map it.
    if (minDistance > 0 && minDistance <= 2 && originalHeader.toLowerCase() !== bestMatch.toLowerCase()) {
      headerMapping[originalHeader] = bestMatch;
      corrections.push(`Corrected column header: "${originalHeader}" was interpreted as "${bestMatch}".`);
    } else {
      headerMapping[originalHeader] = originalHeader; // No change
    }
  }

  return jsonData.map(row => {
    const newRow = {};
    for (const originalHeader in row) {
      const newHeader = headerMapping[originalHeader] || originalHeader;
      newRow[newHeader] = row[originalHeader];
    }
    return newRow;
  });
};

// --- Helper: Find header row and convert to JSON ---
const findAndConvertToJson = (sheet, expectedHeaders) => {
  const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  let bestMatch = { score: -1, rowIndex: -1, headers: [] };

  // Search in the first 5 rows for the best header match
  for (let i = 0; i < Math.min(5, sheetData.length); i++) {
    const row = (sheetData[i] || []).map(h => String(h || '').trim());
    let score = 0;
    const lowerCaseRow = row.map(h => h.toLowerCase());

    for (const expectedHeader of expectedHeaders) {
      if (lowerCaseRow.includes(expectedHeader.toLowerCase())) {
        score++;
      }
    }

    // A good header row should have at least half the expected headers
    if (score > bestMatch.score && score >= expectedHeaders.length / 2) {
      bestMatch = { score, rowIndex: i, headers: row };
    }
  }

  if (bestMatch.rowIndex === -1) {
    console.log(chalk.yellow("⚠️ Could not confidently identify a header row. Defaulting to first row."));
    bestMatch = { score: 0, rowIndex: 0, headers: (sheetData[0] || []).map(h => String(h || '').trim()) };
  } else {
    console.log(chalk.cyan(`✅ Header row identified at row index ${bestMatch.rowIndex + 1}.`));
  }

  const headers = bestMatch.headers;
  const dataRows = sheetData.slice(bestMatch.rowIndex + 1);

  return dataRows.map(row => {
    const rowData = {};
    headers.forEach((header, index) => {
      if (header) rowData[header] = row[index];
    });
    return rowData;
  });
};

// --- Main API Endpoint ---
app.get("/api/budget", async (req, res) => {
  try {
    console.log(chalk.blue("🔹 API: /api/budget endpoint hit. Starting data aggregation..."));

    const budgetData = await CostCenterID.aggregate([
      {
        $lookup: {
          from: Anticipated.collection.name,
          localField: "costCenter",
          foreignField: "CostCenter", // This is the correct field for joining
          as: "anticipatedCostCenter"
        }
      },
      {
        $lookup: {
          from: Actual.collection.name,
          localField: "costCenter", // This is the correct field for joining
          foreignField: "Cost Center", 
          as: "actualCostCenter"
        }
      },
 
      {
        $project: {
          _id: 0,
          costCenter: "$costCenter",
          teamName: "$costCenterName",
          anticipatedCostCenter: 1,
          actualCostCenter: 1
        }
      }
    ]);
     console.log(chalk.green(`✅ Aggregation complete. Found data for ${budgetData.length} cost centers.`));
  
     //find account IDs -Error handling
    const accountIdDocs = await AccountID.find({});
    if (!accountIdDocs || accountIdDocs.length === 0) {
      console.log(chalk.yellow("⚠️ No main accounts found in the AccountID collection. Spend type categorization may be incomplete."));
    }

    //Find account IDs- Create the spend type map with detailed logging
    const spendTypeMap = {};
    console.log(chalk.cyan(`\n🔹 --- Processing ${accountIdDocs.length} Account IDs ---`));
    console.log(chalk.gray('  Raw AccountID documents fetched from DB:'), accountIdDocs.map(d => d.toObject()));
    accountIdDocs.forEach(doc => {
      const mainAccount = findValueByKey(doc.toObject(), 'Main account');

      if (mainAccount != null) {
        const spendType = findValueByKey(doc.toObject(), 'Spend Type');
        const mainAccountName = findValueByKey(doc.toObject(), 'Main Account Name');
        const normalizedMainAccount = Number(mainAccount); // Ensure it's a number for consistency with schema
        console.log(chalk.gray(`    -> Picked up from AccountID: Main Account: [${normalizedMainAccount}] (type: ${typeof normalizedMainAccount}), Name: [${mainAccountName}], Spend Type: [${spendType}]`));

        // Log the raw document to see all columns
        console.log(chalk.green(`  ✅ Reading AccountID Document:`), doc.toObject());
        spendTypeMap[normalizedMainAccount] = { spendType: spendType || 'programs', name: mainAccountName || 'Unnamed Account' };
      }
    });
    console.log(chalk.green("✅ Successfully created spend type category map."));
    console.log(chalk.cyan('  Final Spend Type Map:'), spendTypeCategoryMap);

 const finalBudgetData = {};

    budgetData.forEach(team => {
      const { costCenter, teamName, anticipatedCostCenter, actualCostCenter } = team;
      console.log(chalk.blue(`\n🔹 --- Processing Cost Center: ${teamName} (${costCenter}) ---`));

      // --- Anticipated Data ---
      const monthlyAnticipated = {};
      const spendTypeTotals = {};
     
      if (anticipatedCostCenter && anticipatedCostCenter.length > 0) {
        anticipatedCostCenter.forEach((item, index) => {
          try {
            // Log the raw anticipated item to see all columns
            console.log(chalk.yellow(`  ➡️  Reading Anticipated Item [${index}]:`), item);

            let totalAmountForItem = 0;

            // Dynamically read all columns from the item
            for (const key in item) {
              // Check if the key matches the month format (e.g., 'Mar-25')
              if (/^[A-Za-z]{3}-\d{2}$/.test(key)) {
                const amount = parseFloat(String(item[key]).replace(/,/g, '')) || 0;
                if (amount !== 0) {
                  monthlyAnticipated[key] = (monthlyAnticipated[key] || 0) + amount;
                  totalAmountForItem += amount;
                }
              }
            }

            const mainAccount = findValueByKey(item, "MainAccount");
            const normalizedMainAccount = Number(mainAccount); // Ensure it's a number for lookup
            if (mainAccount != null && totalAmountForItem !== 0) {
              const accountDetails = spendTypeMap[normalizedMainAccount] || { name: `Not Found (${mainAccount})`, spendType: 'programs' };
              const accountName = accountDetails.name;
              const spendType = accountDetails.spendType;
              console.log(chalk.yellow(`    Looking up spend type for anticipated item Main Account: [${normalizedMainAccount}] (type: ${typeof normalizedMainAccount})`));
              console.log(chalk.yellow(`    Spend Type for anticipated item: ${spendType}`));

              if (!spendTypeTotals[accountName]) spendTypeTotals[accountName] = { amount: 0, mainAccount: mainAccount };
              spendTypeTotals[accountName].amount += totalAmountForItem;
            }

          } catch (e) {
            console.error(chalk.red(`❌ Error processing anticipated item [${index}] for Cost Center ${costCenter}: ${e.message}`));
          }
        });
      } else {
        console.log(chalk.yellow("⚠️ No anticipated items found for this cost center."));
      }

      console.log(chalk.green("✅ Finished processing anticipated data."), monthlyAnticipated);

      // --- Actual Data ---
      const monthlyActuals = {};
      console.log(chalk.cyan(`📦 Found ${actualCostCenter?.length || 0} actual items.`));

      if (actualCostCenter && actualCostCenter.length > 0) {
        actualCostCenter.forEach((item, index) => {
          try {
            // Log the raw actual item to see all columns
            console.log(chalk.magenta(`  ➡️  Reading Actual Item [${index}]:`), item);

            const dateValue = findValueByKey(item, 'Date');
            const amountValue = findValueByKey(item, 'Amount');
            const categoryValue = findValueByKey(item, 'Category') || 'General'; // Default if category is missing

            if (!dateValue || amountValue == null) return;

            // Perform date and amount conversion in JavaScript
            const date = new Date(dateValue);
            const amount = parseFloat(String(amountValue).replace(/,/g, '')) || 0;
            const monthKey = date.toLocaleString('en-US', { month: 'short', year: '2-digit' }).replace(" ", "-").toLowerCase();
            
            const mainAccount = findValueByKey(item, "Main Account");
            console.log(chalk.magenta(`    Extracted Main Account for lookup: [${mainAccount}] (type: ${typeof mainAccount})`)); // Added Logging
            const normalizedMainAccount = Number(mainAccount); // Ensure it's a number for lookup
            const accountDetails = spendTypeMap[normalizedMainAccount] || { name: `Not Found (${mainAccount})`, spendType: 'programs' };
            const spendType = accountDetails.spendType;
            console.log(chalk.magenta(`    Spend Type for actual item: ${spendType}`));
            if (!monthlyActuals[monthKey]) monthlyActuals[monthKey] = { amount: 0, category: categoryValue };
            monthlyActuals[monthKey].amount += amount;
            // The category of the last item for a given month will be used.
            monthlyActuals[monthKey].category = categoryValue;

          } catch (e) {
            console.error(chalk.red(`❌ Error processing actual item [${index}] for Cost Center ${costCenter}: ${e.message}`));
          }
        });
      } else {
        console.log(chalk.yellow("⚠️ No actual items found for this cost center."));
      }

      console.log(chalk.green("✅ Finished processing actual data."), monthlyActuals);

      // Combine all data
      // Dynamically create a unique list of months from both anticipated and actual data
      const allMonthKeys = new Set([
        ...Object.keys(monthlyAnticipated),
        ...Object.keys(monthlyActuals).map(k => k.charAt(0).toUpperCase() + k.slice(1)) // Normalize to Title-Case
      ]);
      const monthsData = Array.from(allMonthKeys).map(monthStr => {
        const actualDataForMonth = monthlyActuals[monthStr.toLowerCase()] || { amount: 0, category: 'General' };
        const anticipatedAmount = monthlyAnticipated[monthStr] || 0;
        return {
          month: monthStr,
          actual: actualDataForMonth.amount,
          anticipated: anticipatedAmount,
          category: actualDataForMonth.category
        };
      });

      // Categorize spend types
      const people = [];
      const programs = [];
      Object.entries(spendTypeTotals).forEach(([name, data]) => {
        const { amount, mainAccount } = data; // mainAccount here is the original one from the item, which might be a string
        const normalizedMainAccount = Number(mainAccount); // Ensure it's a number for lookup
        const category = (spendTypeMap[normalizedMainAccount] || { spendType: 'programs' }).spendType;
        const spendItem = { name, amount, value: 0 };
        if (category === 'people') {
          people.push(spendItem);
        } else {
          programs.push(spendItem);
        }
      });

      finalBudgetData[costCenter] = {
        teamName,
        people,
        programs,
        months: monthsData.sort((a, b) => new Date(`01-${a.month}`) - new Date(`01-${b.month}`)),
        actualItems: actualCostCenter // Pass raw actual items to the frontend
      };
    });

    console.log(chalk.green("✅ Successfully processed all data. Sending response to client."));
    res.json(finalBudgetData);



  } catch (error) {
    console.error(chalk.red("❌ Fatal Error in /api/budget endpoint:"), error);
    res.status(500).json({ error: "An unexpected error occurred on the server.", details: error.message });
  }
});

// --- CRUD Endpoints for Actual Records ---

// POST /api/actuals - Add a new actual record
app.post('/api/actuals', async (req, res) => {
  try {
    console.log(chalk.blue('🔹 API: /api/actuals POST endpoint hit.'));
    const newActualData = {
      "Category": findValueByKey(req.body, 'Category'),
      "Cost Center": Number(findValueByKey(req.body, 'Cost Center')), // Ensure number
      "Date": new Date(findValueByKey(req.body, 'Date')), // Convert to Date object
      "Account entry description": findValueByKey(req.body, 'Account entry description'),
      "Main Account": String(findValueByKey(req.body, 'Main Account')), // Ensure string
      "Main Account Name": findValueByKey(req.body, 'Main Account Name'),
      "Amount": Number(findValueByKey(req.body, 'Amount')),
      "Party Name": findValueByKey(req.body, 'Party Name'),
      "Document Description": findValueByKey(req.body, 'Document Description'),
    };

    const createdActual = await Actual.create(newActualData);
    console.log(chalk.green(`✅ Actual record added successfully for Cost Center ${newActualData['Cost Center']}.`));
    res.status(201).json({ message: 'Actual record added successfully', record: createdActual });
  } catch (error) {
    console.error(chalk.red('❌ Error adding actual record:'), error);
    res.status(500).json({ error: 'Failed to add record', details: error.message });
  }
});

// PUT /api/actuals/:id - Update an existing actual record
app.put('/api/actuals/:id', async (req, res) => {
  try {
    console.log(chalk.blue(`🔹 API: /api/actuals/${req.params.id} PUT endpoint hit.`));
    const { id } = req.params;
    const updatedActualData = {
      "Category": findValueByKey(req.body, 'Category'),
      "Cost Center": Number(findValueByKey(req.body, 'Cost Center')), // Ensure number
      "Date": new Date(findValueByKey(req.body, 'Date')),
      "Account entry description": findValueByKey(req.body, 'Account entry description'),
      "Main Account": String(findValueByKey(req.body, 'Main Account')),
      "Main Account Name": findValueByKey(req.body, 'Main Account Name'),
      "Amount": Number(findValueByKey(req.body, 'Amount')),
      "Party Name": findValueByKey(req.body, 'Party Name'),
      "Document Description": findValueByKey(req.body, 'Document Description'),
    };

    const updatedActual = await Actual.findByIdAndUpdate(id, updatedActualData, { new: true });
    if (!updatedActual) {
      return res.status(404).json({ message: 'Actual record not found' });
    }
    console.log(chalk.green(`✅ Actual record ${id} updated successfully.`));
    res.status(200).json({ message: 'Actual record updated successfully', record: updatedActual });
  } catch (error) {
    console.error(chalk.red(`❌ Error updating actual record ${req.params.id}:`), error);
    res.status(500).json({ error: 'Failed to update record', details: error.message });
  }
});

// DELETE /api/actuals/:id - Delete an actual record
app.delete('/api/actuals/:id', async (req, res) => {
  try {
    console.log(chalk.blue(`🔹 API: /api/actuals/${req.params.id} DELETE endpoint hit.`));
    const { id } = req.params;
    const deletedActual = await Actual.findByIdAndDelete(id);
    if (!deletedActual) {
      return res.status(404).json({ message: 'Actual record not found' });
    }
    console.log(chalk.green(`✅ Actual record ${id} deleted successfully.`));
    res.status(200).json({ message: 'Actual record deleted successfully' });
  } catch (error) {
    console.error(chalk.red(`❌ Error deleting actual record ${req.params.id}:`), error);
    res.status(500).json({ error: 'Failed to delete record', details: error.message });
  }
});

// --- File Upload Endpoints ---

app.post('/api/upload/actuals', upload.single('file'), async (req, res) => {
  try {
    console.log(chalk.blue('🔹 API: /api/upload/actuals endpoint hit.'));
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const corrections = [];
    const expectedActualsHeaders = ['Category', 'Cost Center', 'Date', 'Account entry description', 'Main Account', 'Main Account Name', 'Amount', 'Party Name', 'Document Description'];
    const jsonData = findAndConvertToJson(worksheet, expectedActualsHeaders);
    const normalizedJsonData = normalizeHeaders(jsonData, expectedActualsHeaders, corrections);


    // --- Validation Logic ---
    const errors = [];
    //const requiredFields = ['Cost Center', 'Date', 'Amount', 'Document Description'];

    normalizedJsonData.forEach((row, index) => {
      const rowNum = index + 2; // Excel rows are 1-based, plus header row
      const rowErrors = [];

      // Amount validation (after parsing attempt)
      const amount = findValueByKey(row, 'Amount');
      if (amount != null && isNaN(parseAccountingNumber(amount))) { // Use normalized data for validation
        rowErrors.push(`Mismatch in columns datatype. Expected datatype for column 'Amount' is Number, but the value could not be converted.`);
      }

      // Date validation
      const date = findValueByKey(row, 'Date');
      if (date != null && isNaN(new Date(date).getTime()) && typeof date !== 'number') {
        rowErrors.push(`Mismatch in columns datatype. Expected datatype for column 'Date' is a valid date format (e.g., YYYY-MM-DD), but the value could not be converted.`);
      }

      if (rowErrors.length > 0) {
        errors.push(`Row ${rowNum}: ${rowErrors.join('; ')}`);
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({ message: 'File validation failed. Please correct the following errors:', errors });
    }

    // --- Versioning Logic ---
    const latestVersion = await ActualsUpload.findOne().sort({ versionNumber: -1 });
    const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    const newUploadVersion = new ActualsUpload({
      versionNumber: newVersionNumber,
      fileName: req.file.originalname,
      data: normalizedJsonData, // Save the corrected data
    });
    await newUploadVersion.save();
    console.log(chalk.cyan(`📝 Saved actuals upload as version ${newVersionNumber}.`));

    // --- Processing Logic (Insert all records) ---
    const actualsToProcess = normalizedJsonData.map(row => ({
        'Category': findValueByKey(row, 'Category') || null,
        'Cost Center': Number(String(findValueByKey(row, 'Cost Center') || '').trim()),
        'Date': new Date(findValueByKey(row, 'Date')),
        'Account entry description': findValueByKey(row, 'Account entry description') || null,
        'Main Account': String(findValueByKey(row, 'Main Account')),
        'Main Account Name': findValueByKey(row, 'Main Account Name') || null,
        'Amount': parseAccountingNumber(findValueByKey(row, 'Amount')),
        'Party Name': findValueByKey(row, 'Party Name') || null,
        'Document Description': findValueByKey(row, 'Document Description') || null,
    })).filter(doc => doc['Cost Center'] != null && doc['Amount'] != null);

    if (actualsToProcess.length > 0) {
      // Insert all records as new documents, as Document Description is no longer a unique identifier
      await Actual.insertMany(actualsToProcess);
      const totalCount = actualsToProcess.length;
      console.log(chalk.green(`✅ Successfully processed ${totalCount} actuals documents.`));
      res.status(200).json({ 
        message: `Successfully uploaded and processed ${totalCount} records. Saved as version ${newVersionNumber}.`,
        corrections: corrections
      });
    } else {
      res.status(400).json({ message: 'No valid actuals data found in the file to process.' });
    }
  } catch (error) {
    console.error(chalk.red('❌ Error processing actuals upload:'), error);
    res.status(500).json({ error: 'Failed to process file.', details: error.message });
  }
});

app.post('/api/upload/anticipateds', upload.single('file'), async (req, res) => {
  try {
    console.log(chalk.blue('🔹 API: /api/upload/anticipateds endpoint hit.'));
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
//NEW CODE TO HANDLE MONTH COLUMN VARIATIONS:
const corrections = [];

const staticExpectedHeaders = [
  'Account name',
  'MainAccount',
  'CostCenter'
];

// Regex for correct month pattern: Mar-25, Aug-03, etc.
const monthRegex = /^[A-Za-z]{3}-\d{2}$/;

// Check if header is a date
function tryParseDate(header) {
  // If Excel exported a serial date → convert it
  if (!isNaN(header)) {
    const excelDate = new Date((header - 25569) * 86400 * 1000);
    if (!isNaN(excelDate.getTime())) return excelDate;
  }

  const parsed = new Date(header);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

// Convert Date → MMM-YY
function formatDateToMonthCode(dateObj) {
  const month = dateObj.toLocaleString("en-US", { month: "short" });
  const year = String(dateObj.getFullYear()).slice(-2);
  return `${month}-${year}`;
}

// Extract actual sheet headers
const sheetHeaders = Object.keys(worksheet[0] || {});

// Convert headers
const convertedHeaders = sheetHeaders.map(h => {
  const trimmed = h.trim();

  // Case 1: Already valid (Mar-25, Aug-28)
  if (monthRegex.test(trimmed)) return trimmed;

  // Case 2: Try converting date headers
  const parsedDate = tryParseDate(trimmed);
  if (parsedDate) return formatDateToMonthCode(parsedDate);

  return trimmed; // keep as is if not a date or month
});

// Filter dynamic month headers
const dynamicMonthHeaders = convertedHeaders.filter(h => monthRegex.test(h));

// Combine final expected headers
const expectedAnticipatedHeaders = [
  ...staticExpectedHeaders,
  ...dynamicMonthHeaders
];

const jsonData = findAndConvertToJson(worksheet, expectedAnticipatedHeaders);
//END OF NEW CODE TO HANDLE MONTH VARIATIONS

/*  const expectedAnticipatedHeaders = ['Account name', 'MainAccount', 'CostCenter', 'Mar-25', 'Apr-25', 'May-25', 'Jun-25', 'Jul-25', 'Aug-25', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25', 'Jan-26', 'Feb-26'];
    const jsonData = findAndConvertToJson(worksheet, expectedAnticipatedHeaders); */

    // Filter out completely empty rows
    const filteredJsonData = jsonData.filter(row => 
      Object.values(row).some(value => value !== null && String(value).trim() !== '')
    );
    const normalizedJsonData = normalizeHeaders(filteredJsonData, expectedAnticipatedHeaders, corrections);

    if (corrections.length > 0) {
      console.log(chalk.yellow('Corrections made to headers:'), corrections);
    }
    
    // --- Validation Logic ---
    const errors = [];

    normalizedJsonData.forEach((row, index) => {
      const rowNum = index + 2;
      const rowErrors = [];

      // Check for required fields individually to provide specific error messages
      if (findValueByKey(row, 'CostCenter') == null) {
        rowErrors.push(`The "CostCenter" value is required but is missing in this row.`);
      }
      if (findValueByKey(row, 'MainAccount') == null) {
        rowErrors.push(`The "MainAccount" value is required but is missing in this row`);
      }
      // Check if at least one month column exists and is a valid number
      let hasValidMonthData = false;
      for (const key in row) {
        // Normalize the key before testing it, just like in the processing logic
        const normalizedKey = key.trim().replace(/\s*-\s*/, '-');
        if (/^[A-Za-z]{3}-\d{2}$/.test(normalizedKey)) {
          hasValidMonthData = true;
          break;
        }
      }
      if (!hasValidMonthData) {
        rowErrors.push(`Row contains no valid monthly amount data or invalid format.`);
      }
      if (rowErrors.length > 0) {
        errors.push(`Row ${rowNum}: ${rowErrors.join('; ')}`);
      }
    });

    if (errors.length > 0) {
        return res.status(400).json({ message: 'File validation failed. Please correct the following errors:', errors });
    }

    // --- Versioning Logic ---
    const latestVersion = await AnticipatedsUpload.findOne().sort({ versionNumber: -1 });
    const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    const newUploadVersion = new AnticipatedsUpload({
      versionNumber: newVersionNumber,
      fileName: req.file.originalname,
      data: normalizedJsonData,
    });
    await newUploadVersion.save();
    console.log(chalk.cyan(`📝 Saved anticipateds upload as version ${newVersionNumber}.`));

    const anticipatedToInsert = normalizedJsonData.map(row => {
      const doc = {
        'Account name': findValueByKey(row, 'Account name') || null,
        'MainAccount': Number(String(findValueByKey(row, 'MainAccount') || '').trim()),
        'CostCenter': Number(String(findValueByKey(row, 'CostCenter') || '').trim()),
      };
      // Dynamically add month columns
      for (const key in row) {
        // Normalize the key by removing spaces around the hyphen and trimming
        const normalizedKey = key.trim().replace(/\s*-\s*/, '-');
        // Check if the normalized key matches the expected 'MMM-YY' format
        if (/^[A-Za-z]{3}-\d{2}$/.test(normalizedKey)) {
          if (key !== normalizedKey) {
            console.log(chalk.yellow(`  - Corrected month column spacing: "${key}" to "${normalizedKey}".`));
          }
          // Use the normalized key for the document, but get the value from the original key
          doc[normalizedKey] = parseAccountingNumber(row[key]);
        }
      }
      return doc;
    }).filter(doc => doc.CostCenter != null && doc.MainAccount != null);

    // --- Processing Logic (Insert all records) ---
    if (anticipatedToInsert.length > 0) {
      // Insert all records as new documents
      await Anticipated.insertMany(anticipatedToInsert);
      const totalCount = anticipatedToInsert.length;
      console.log(chalk.green(`✅ Successfully processed ${totalCount} anticipated documents.`));
      res.status(200).json({ 
        message: `Successfully uploaded and processed ${totalCount} records. Saved as version ${newVersionNumber}.`,
        corrections: corrections
      });
    } else {
      res.status(400).json({ message: 'No valid anticipated data found in the file.' });
    }
  } catch (error) {
    console.error(chalk.red('❌ Error processing anticipated upload:'), error);
    res.status(500).json({ error: 'Failed to process file.', details: error.message });
  }
});

// --- Upload History Endpoints ---

// GET all versions for a data type
app.get('/api/uploads/:dataType/versions', async (req, res) => {
  const { dataType } = req.params;
  const Model = dataType === 'actuals' ? ActualsUpload : AnticipatedsUpload;
  try {
    const versions = await Model.find({}, 'versionNumber uploadDate fileName').sort({ versionNumber: -1 });
    res.status(200).json(versions);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch ${dataType} versions.`, details: error.message });
  }
});

// GET a specific version's data
app.get('/api/uploads/:dataType/versions/:id', async (req, res) => {
  const { dataType, id } = req.params;
  const Model = dataType === 'actuals' ? ActualsUpload : AnticipatedsUpload;
  try {
    const version = await Model.findById(id);
    if (!version) {
      return res.status(404).json({ message: 'Version not found.' });
    }
    res.status(200).json(version);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch version ${id}.`, details: error.message });
  }
});

// UPDATE a record within a version's data
app.put('/api/uploads/:dataType/versions/:id/records/:recordIndex', async (req, res) => {
    const { dataType, id, recordIndex } = req.params;
    const Model = dataType === 'actuals' ? ActualsUpload : AnticipatedsUpload;
    try {
        const version = await Model.findById(id);
        if (!version) {
            return res.status(404).json({ message: 'Version not found.' });
        }
        const index = parseInt(recordIndex, 10);
        if (index < 0 || index >= version.data.length) {
            return res.status(400).json({ message: 'Invalid record index.' });
        }
        // Replace the record at the specified index
        version.data[index] = req.body;
        version.markModified('data'); // Important: Mark the array as modified for Mongoose
        await version.save();
        res.status(200).json({ message: 'Record updated successfully.', record: version.data[index] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update record.', details: error.message });
    }
});

// DELETE an entire upload version
app.delete('/api/uploads/:dataType/versions/:id', async (req, res) => {
    const { dataType, id } = req.params;
    const VersionModel = dataType === 'actuals' ? ActualsUpload : AnticipatedsUpload;
    const DataModel = dataType === 'actuals' ? Actual : Anticipated;

    try {
        const deletedVersion = await VersionModel.findByIdAndDelete(id);
        if (!deletedVersion) {
            return res.status(404).json({ message: 'Version not found.' });
        }

        console.log(chalk.cyan(`🗑️ Deleted ${dataType} version. Rebuilding main data collection...`));

        // 1. Clear the main data collection
        await DataModel.deleteMany({});
        console.log(chalk.yellow(`  - Emptied the '${DataModel.collection.name}' collection.`));

        // 2. Get all remaining versions in order
        const remainingVersions = await VersionModel.find({}).sort({ versionNumber: 1 });

        // 3. Re-process each version to rebuild the data
        for (const version of remainingVersions) {
            console.log(chalk.blue(`  - Reprocessing version ${version.versionNumber}...`));
            const jsonData = version.data;

            if (dataType === 'actuals') {
                const actualsToProcess = jsonData.map(row => ({ // Map to the Actual schema structure
                    'Category': findValueByKey(row, 'Category') || null, // Default to null if not found
                    'Cost Center': Number(String(findValueByKey(row, 'Cost Center') || '').trim()),
                    'Date': new Date(findValueByKey(row, 'Date')),
                    'Account entry description': findValueByKey(row, 'Account entry description') || null,
                    'Main Account': String(findValueByKey(row, 'Main Account')),
                    'Main Account Name': findValueByKey(row, 'Main Account Name') || null,
                    'Amount': parseAccountingNumber(findValueByKey(row, 'Amount')),
                    'Party Name': findValueByKey(row, 'Party Name') || null,
                    'Document Description': findValueByKey(row, 'Document Description') || null,
                })).filter(doc => doc['Cost Center'] != null && doc['Amount'] != null); // Filter out invalid records

                await DataModel.insertMany(actualsToProcess); // Insert all records from this version
            } else if (dataType === 'anticipateds') {
                const anticipatedToProcess = jsonData.map(row => {
                    const doc = {
                        'Account name': findValueByKey(row, 'Account name') || null,
                        'MainAccount': Number.isNaN(Number(String(findValueByKey(row, 'MainAccount') || '').trim())) ? null : Number(String(findValueByKey(row, 'MainAccount') || '').trim()),
                        'CostCenter': Number.isNaN(Number(String(findValueByKey(row, 'CostCenter') || '').trim())) ? null : Number(String(findValueByKey(row, 'CostCenter') || '').trim()),
                    };
                    for (const key in row) {
                        if (/^[A-Za-z]{3}-\d{2}$/.test(key)) {
                            // Normalize the key by removing spaces around the hyphen and trimming
                            const normalizedKey = key.trim().replace(/\s*-\s*/, '-');
                            if (key !== normalizedKey) {
                                console.log(chalk.yellow(`  - Corrected month column spacing during rebuild: "${key}" to "${normalizedKey}".`));
                            }
                            // Use the normalized key for the document
                            doc[normalizedKey] = parseAccountingNumber(row[key]);
                        }
                    }
                    return doc;
                }).filter(doc => doc.CostCenter != null && doc.MainAccount != null);

                // Insert all records from this version
                await DataModel.insertMany(anticipatedToProcess);
            }
        }

        console.log(chalk.green(`✅ Successfully rebuilt the '${DataModel.collection.name}' collection.`));
        res.status(200).json({ message: 'Version deleted and data rebuilt successfully.' });
    } catch (error) {
        console.error(chalk.red(`❌ Error deleting version or rebuilding data for ${dataType}:`), error);
        res.status(500).json({ error: 'Failed to delete version and rebuild data.', details: error.message });
    }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(chalk.magenta(`🚀 Server running at http://localhost:${port}`)));
