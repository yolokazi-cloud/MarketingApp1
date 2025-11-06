import mongoose from 'mongoose';
import CostCenterID from './models/CostCenterID.js';
import AccountID from './models/AccountID.js';
import Anticipated from './models/Anticipated.js';
import Actual from './models/Actual.js';

const MONGO_URI = "mongodb://localhost:27017/MarketingBudget";

const costCenterData = [
  { "costCenter": 14152001, "costCenterName": "Marketing Operations" },
  { "costCenter": 14152002, "costCenterName": "Communications - PR and Social" },
  { "costCenter": 14152003, "costCenterName": "Revenue Marketing" },
  { "costCenter": 14152004, "costCenterName": "Communications - Brand and Sponsorships" },
  { "costCenter": 14152005, "costCenterName": "Account Based Marketing" },
  { "costCenter": 14152006, "costCenterName": "Shared Services" },
  { "costCenter": 14152007, "costCenterName": "Customer Experience" },
  { "costCenter": 14152008, "costCenterName": "Communications - Employee Engagement" },
  { "costCenter": 14152009, "costCenterName": "Partner Marketing" },
  { "costCenter": 14152010, "costCenterName": "Marketing Projects" },
  { "costCenter": 14152011, "costCenterName": "Office of the CTO" },
  { "costCenter": 14152012, "costCenterName": "IT Services Marketing" }
];

const accountIDData = [
  { "Main account": "730007", "main account name": "Exp Consultancy Other", "spend type": "program" },
  { "Main account": "722014", "main account name": "Exp Content Creation", "spend type": "program" },
  { "Main account": "722008", "main account name": "Exp Customer Events", "spend type": "program" },
  { "Main account": "722002", "main account name": "Exp Corporate Events", "spend type": "program" },
  { "Main account": "722007", "main account name": "Exp Conferences and Seminars", "spend type": "program" },
  { "Main account": "710013", "main account name": "Exp Sponsorships", "spend type": "program" },
  { "Main account": "722012", "main account name": "Exp Website Maintenance", "spend type": "program" },
  { "Main account": "752001", "main account name": "Exp Licences Other", "spend type": "program" },
  { "Main account": "722011", "main account name": "Exp Paid Media", "spend type": "program" },
  { "Main account": "722006", "main account name": "Exp Catalogues, Promotions and Samples", "spend type": "program" },
  { "Main account": "710010", "main account name": "Exp Salaries Permanent", "spend type": "people" },
  { "Main account": "710250", "main account name": "Exp Group Altron Pension Fund", "spend type": "people" },
  { "Main account": "710291", "main account name": "Exp Company Contribution UIF", "spend type": "people" },
  { "Main account": "710292", "main account name": "Exp Company Contribution Workmens Compensation", "spend type": "people" },
  { "Main account": "710295", "main account name": "Exp Company Contribution Other", "spend type": "people" },
  { "Main account": "784010", "main account name": "Exp SDL Levy", "spend type": "people" },
  { "Main account": "792004", "main account name": "Exp Travelling Local", "spend type": "people" },
  { "Main account": "790001", "main account name": "Exp ICT Costs", "spend type": "program" },
  { "Main account": "766001", "main account name": "Exp General Expenses", "spend type": "program" },
  { "Main account": "792001", "main account name": "Exp Entertaining", "spend type": "program" },
  { "Main account": "722005", "main account name": "Exp Gifts and Flowers", "spend type": "program" },
  { "Main account": "825202", "main account name": "Oth Forex Losses Unrealised", "spend type": "program" },
  { "Main account": "825101", "main account name": "Oth Forex Profits Realised", "spend type": "program" }
];

const anticipatedData = [
  {
    "Account name": "Exp Consultancy Other",
    "MainAccount": 730007,
    "CostCenter": 14152001, // Marketing Operations
    "Mar-25": 10000, "Apr-25": 12000, "May-25": 8000, "Jun-25": 15000,
    "Jul-25": 10000, "Aug-25": 10000, "Sep-25": 11000, "Oct-25": 9000,
    "Nov-25": 13000, "Dec-25": 20000, "Jan-26": 10000, "Feb-26": 10000
  },
  {
    "Account name": "Exp Salaries Permanent",
    "MainAccount": 710010,
    "CostCenter": 14152006, // Shared Services
    "Mar-25": 50000, "Apr-25": 50000, "May-25": 50000, "Jun-25": 50000,
    "Jul-25": 52000, "Aug-25": 52000, "Sep-25": 52000, "Oct-25": 52000,
    "Nov-25": 52000, "Dec-25": 55000, "Jan-26": 52000, "Feb-26": 52000
  }
];

const actualData = [
  {
    "Category": "Consulting",
    "Cost Center": 14152001, // Marketing Operations
    "Date": new Date("2025-03-15"),
    "Account entry description": "Invoice for Q1 consulting",
    "Main Account": "730007",
    "Main Account Name": "Exp Consultancy Other",
    "Amount": 9500.00,
    "Party Name": "Consulting Firm A",
    "Document Description": "INV-001"
  },
  {
    "Category": "Salaries",
    "Cost Center": 14152006, // Shared Services
    "Date": new Date("2025-03-25"),
    "Account entry description": "March Salaries",
    "Main Account": "710010",
    "Main Account Name": "Exp Salaries Permanent",
    "Amount": 49850.50,
    "Party Name": "Payroll",
    "Document Description": "MAR-PAY"
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Successfully connected to MongoDB for seeding.");

    // --- Seed CostCenterID ---
    await CostCenterID.deleteMany({});
    console.log("Cleared existing CostCenterID data.");
    await CostCenterID.insertMany(costCenterData);
    console.log("Successfully seeded the CostCenterID collection.");

    // --- Seed AccountID ---
    await AccountID.deleteMany({});
    console.log("Cleared existing AccountID data.");
    await AccountID.insertMany(accountIDData);
    console.log("Successfully seeded the AccountID collection.");

    // --- Seed Anticipated ---
    await Anticipated.deleteMany({});
    console.log("Cleared existing Anticipated data.");
    await Anticipated.insertMany(anticipatedData);
    console.log("Successfully seeded the Anticipated collection.");

    // --- Seed Actual ---
    await Actual.deleteMany({});
    console.log("Cleared existing Actual data.");
    await Actual.insertMany(actualData);
    console.log("Successfully seeded the Actual collection.");

  } catch (error) {
    console.error("Error seeding the database:", error);
  } finally {
    // Close the connection
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
};

seedDatabase();
