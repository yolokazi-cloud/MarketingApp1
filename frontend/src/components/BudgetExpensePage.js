import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Upload, TrendingUp, DollarSign, Edit, Trash2, PlusCircle, Save, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const BudgetExpensePage = ({ selectedTeam, budgetData, setBudgetData, onDataUpdate, allAccounts }) => {
  const [updatedTeamData, setUpdatedTeamData] = useState(null);
  const [isAddingMonth, setIsAddingMonth] = useState(false);
  const [newRecord, setNewRecord] = useState({
    "Date": "",
    "Account entry description": "",
    "Main Account": "",
    "Main Account Name": "",
    "Amount": "",
    "Party Name": "",
    "Document Description": "",
    "Category": ""
  });
  const [editingMonthKey, setEditingMonthKey] = useState(null);
  const [editingRecordData, setEditingRecordData] = useState(null); // Will hold the _id for editing
  const [addMonthError, setAddMonthError] = useState('');
  const [editMonthError, setEditMonthError] = useState('');
  const [monthlyChartFilter, setMonthlyChartFilter] = useState('all'); // 'all', 'people', 'programs'
  
  // Reset updated data when team changes
  React.useEffect(() => {
    setUpdatedTeamData(null);
  }, [selectedTeam]);
  
  // Use updated data if available, otherwise use original data
  const teamData = updatedTeamData || budgetData[selectedTeam];

  const accountMap = useMemo(() => {
    const map = new Map();
    allAccounts.forEach(acc => map.set(acc['Main account'], acc['Main Account Name']));
    return map;
  }, [allAccounts]);

  const allSpendTypesWithValues = useMemo(() => {
    if (!teamData) return [];
    const all = [...(teamData.people || []), ...(teamData.programs || [])];
    const totalAmount = all.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    if (totalAmount === 0) {
      return all.map(item => ({ ...item, value: 0 }));
    }

    return all.map(item => ({
      ...item,
      value: Math.round((item.amount / totalAmount) * 100)
    }));
  }, [teamData]);

  const processUploadedData = (uploadedRows) => {
    const newBudgetData = { ...budgetData };
    const teamDataForUpdate = newBudgetData[selectedTeam];
    if (!teamDataForUpdate) return budgetData;

    const monthsMap = new Map(teamDataForUpdate.months.map((m, i) => [`${m.month}-${m.category}`, { ...m, originalIndex: i }]));

    uploadedRows.forEach(row => {
      const dateKey = Object.keys(row).find(k => k.toLowerCase() === 'date');
      const monthKey = Object.keys(row).find(k => k.toLowerCase() === 'year month');
      const categoryKey = Object.keys(row).find(k => k.toLowerCase() === 'category');
      const actualKey = Object.keys(row).find(k => k.toLowerCase() === 'actual');
      const anticipatedKey = Object.keys(row).find(k => k.toLowerCase() === 'anticipated');

      if (row[monthKey] && row[categoryKey]) {
        const monthName = row[monthKey];
        const categoryName = row[categoryKey];
        const mapKey = `${monthName}-${categoryName}`;
        const existingMonth = monthsMap.get(mapKey);

        const newActual = actualKey && !isNaN(parseFloat(row[actualKey])) ? parseFloat(row[actualKey]) : 0;
        const newAnticipated = anticipatedKey && !isNaN(parseFloat(row[anticipatedKey])) ? parseFloat(row[anticipatedKey]) : 0;

        if (existingMonth) {
          existingMonth.actual += newActual;
          existingMonth.anticipated += newAnticipated;
          monthsMap.set(mapKey, existingMonth);
        } else {
          const newRecord = {
            date: row[dateKey] || '',
            month: monthName,
            category: categoryName,
            actual: newActual,
            anticipated: newAnticipated
          };
          monthsMap.set(mapKey, newRecord);
        }
      }
    });

    teamDataForUpdate.months = Array.from(monthsMap.values()).map(({ originalIndex, ...rest }) => rest);
    return newBudgetData;
  };
  
 const handleFileUpload = (event) => {
 const file = event.target.files[0];
  if (!file) return;

  if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target.result;
      const lines = csv.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const jsonData = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',');
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim() || '';
        });
        return row;
      });
      onDataUpdate(processUploadedData(jsonData));
    };
    reader.readAsText(file);
  } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result); // ✅ make sure it's a typed array
      const workbook = XLSX.read(data, { type: 'array' });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(sheet, {
        header: 1, // get raw rows first
        defval: '' // fill empty cells with ''
      });

      // If you want headers as objects like CSV parsing:
      const [headers, ...rows] = jsonData;
      const formatted = rows.map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = row[i] ?? '';
        });
        return obj;
      });

      onDataUpdate(processUploadedData(formatted));
    };
      reader.readAsArrayBuffer(file);
  }
};


  const handleDownloadMonthlyXLSX = () => {
    if (!teamData || !teamData.actualItems) return;

    const headers = ['Date', 'Description', 'Document Description', 'Main Account Name', 'Party Name', 'Category', 'Amount'];
    
    const dataForSheet = teamData.actualItems.map(item => {
      return {
        'Date': item.Date ? new Date(item.Date).toLocaleDateString('en-ZA') : '',
        'Description': item["Account entry description"],
        'Document Description': item["Document Description"],
        'Main Account Name': item["Main Account Name"],
        'Party Name': item["Party Name"],
        'Category': item.Category,
        'Amount': item.Amount
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Monthly Budget');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${teamData.teamName}-monthly-budget.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddNewMonthClick = () => {
    setIsAddingMonth(true);
    setAddMonthError('');
  };

  const handleDateChangeForEditRecord = (dateStr) => {
       let newMonth = editingRecordData.month;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      try {
        const [year, monthNum, day] = dateStr.split('-').map(Number);
        const date = new Date(year, monthNum - 1, day);
        const monthStr = date.toLocaleString('en-US', { month: 'short' });
        const yearStr = (year % 100).toString().padStart(2, '0');
        newMonth = `${monthStr}-${yearStr}`;
      } catch (e) { /* Do nothing on invalid date */ }
    }
    setEditingRecordData({ ...editingRecordData, Date: dateStr });
    if (editMonthError) setEditMonthError('');
  };

  const handleDateChangeForNewRecord = (dateStr) => {
    let newMonth = newRecord.month;
    // Automatically populate the Year Month field if the date is valid
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      try {
        const [year, monthNum, day] = dateStr.split('-').map(Number);
        const date = new Date(year, monthNum - 1, day);
        const monthStr = date.toLocaleString('en-US', { month: 'short' });
        const yearStr = (year % 100).toString().padStart(2, '0');
        newMonth = `${monthStr}-${yearStr}`;
      } catch (e) {
        // Invalid date, do nothing
      }
    }
    setNewRecord({ ...newRecord, Date: dateStr });
  };

  const handleAccountChange = (e, isEditing = false) => { // Renamed from handleAccountChange
    const mainAccount = e.target.value;
    const mainAccountName = accountMap.get(Number(mainAccount)) || '';
    if (isEditing) {
      setEditingRecordData({ ...editingRecordData, "Main Account": mainAccount, "Main Account Name": mainAccountName });
    } else {
      setNewRecord({ ...newRecord, "Main Account": mainAccount, "Main Account Name": mainAccountName });
    }
  };

  const handleSaveNewMonth = async () => { // Made async
    const { Date: date, "Main Account": mainAccount, Amount: amount } = newRecord;
    if (!date.trim() || !mainAccount.trim() || amount === '') {
      setAddMonthError("Please fill out all fields for the new record.");
      return;
    }

    // Date format validation (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setAddMonthError("Invalid date format. Please use YYYY-MM-DD.");
      return;
    }

    const newAmount = parseFloat(amount);
    if (isNaN(newAmount)) {
      setAddMonthError("Invalid number entered for Amount.");
      return;
    }

    const recordToSave = {
      ...newRecord,
      "Cost Center": Number(selectedTeam), // Add costCenter from selectedTeam
      "Date": new Date(newRecord.Date).toISOString(), // Ensure ISO string for backend
      "Amount": newAmount,
      "Main Account": String(newRecord["Main Account"]) // Ensure string for Main Account
    };

    try {
      const response = await fetch('http://localhost:3001/api/actualsuploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordToSave),
      });
      if (!response.ok) throw new Error('Failed to add record');
      await response.json(); // Consume response
      onDataUpdate(); // Refresh all data from backend
      setIsAddingMonth(false);
      setNewRecord({ Date: "", "Account entry description": "", "Main Account": "", "Main Account Name": "", Amount: "", "Party Name": "", "Document Description": "", Category: "", spendType: "" });
      setAddMonthError('');
    } catch (error) {
      setAddMonthError(`Error adding record: ${error.message}`);
    }
  };

  const handleEditMonthClick = (record) => { // Pass the full record, not just index
    setEditingMonthKey(record._id); // Use _id as the key for editing
    setEditingRecordData({ ...record });
    setEditMonthError('');
  };

  const handleCancelEdit = () => {
    setEditingMonthKey(null);
    setEditingRecordData(null);
    setEditMonthError('');
  };

  const handleSaveUpdatedMonth = async () => {
    if (!editingRecordData) return;
    const { Date: date, "Main Account": mainAccount, Amount: amount } = editingRecordData;

    if (!mainAccount.trim() || amount === '') {
      setEditMonthError("Please fill out all fields.");
      return;
    }

    const effectiveDate = date; // 'date' is already editingRecordData.Date
    if (effectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate.trim())) {
      setEditMonthError("Invalid date format. Please use YYYY-MM-DD.");
      return;
    }

    const newAmount = parseFloat(amount);
    if (isNaN(newAmount)) {
      setEditMonthError("Invalid number entered for Amount.");
      return;
    }

    const recordToSave = {
      ...editingRecordData,
      Amount: newAmount,
      "Main Account": String(editingRecordData["Main Account"])
    };

    try {
      const response = await fetch(`http://localhost:3001/api/actuals/${editingMonthKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordToSave),
      });
      if (!response.ok) throw new Error('Failed to update record');
      await response.json();
      onDataUpdate();
      setEditingMonthKey(null);
      setEditingRecordData(null);
      setEditMonthError('');
    } catch (error) {
      setEditMonthError(`Error updating record: ${error.message}`);
    }
  };
  
  const handleDeleteMonth = async (recordToDelete) => {
    if (window.confirm(`Are you sure you want to delete this record?`)) {
      try {
        const response = await fetch(`http://localhost:3001/api/actuals/${recordToDelete._id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete record');
        onDataUpdate();
      } catch (error) {
        alert(`Error: ${error.message}`);
      }
    }
  };

  const totalActual = teamData.months.reduce((sum, month) => sum + month.actual, 0);
  const totalAnticipated = teamData.months.reduce((sum, month) => sum + month.anticipated, 0);
  const variance = totalActual - totalAnticipated;

  // Helper to get a full date from "MMM-YY"
  const getFullDate = (monthStr) => {
    if (!monthStr) return '';
    const [mon, year] = monthStr.split('-');
    const date = new Date(`${mon} 1, 20${year}`);
    return !isNaN(date) ? date.toISOString().split('T')[0] : '';
  };

  if (!teamData) {
    return (
      <div className="p-6 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-500">No Data Available</h2>
          <p className="text-gray-400 mt-2">There is no budget data for the selected cost center: {selectedTeam || 'N/A'}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1F4659] mb-4">Budget Details - {teamData.teamName}</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-600">Total Actual</span>
            </div>
            <span className="text-2xl font-bold text-blue-600">R{totalActual.toLocaleString('en-ZA')}</span>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-600">Total Anticipated</span>
            </div>
            <span className="text-2xl font-bold text-orange-600">R{totalAnticipated.toLocaleString('en-ZA')}</span>
          </div>
          <div className={`p-4 rounded-lg ${variance >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className={`w-5 h-5 ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`} />
              <span className={`text-sm font-medium ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>Variance</span>
            </div>
            <span className={`text-2xl font-bold ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              R{Math.abs(variance).toLocaleString('en-ZA')}
            </span>
          </div>
        </div>
      </div>

      {/* Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Comparison */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 lg:col-span-2">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-semibold text-gray-800">Actual vs Anticipated</h3>
            <div className="flex border border-gray-200 rounded-md p-0.5">
              {['All', 'People', 'Programs'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setMonthlyChartFilter(filter.toLowerCase())}
                  className={`px-2 py-0.5 text-xs rounded-sm transition-colors ${
                    monthlyChartFilter === filter.toLowerCase() ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >{filter}</button>
              ))}
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {monthlyChartFilter === 'all' 
              ? 'Monthly comparison of actual expenditure against anticipated budget targets.'
              : `Monthly spend breakdown for ${monthlyChartFilter.charAt(0).toUpperCase() + monthlyChartFilter.slice(1)}.`
            }
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {monthlyChartFilter === 'all' ? (
                <BarChart data={
                  // Aggregate data by month for the 'All' view
                  Object.values(teamData.months.reduce((acc, month) => {
                    if (!acc[month.month]) {
                      acc[month.month] = { month: month.month, actual: 0, anticipated: 0 };
                    }
                    acc[month.month].actual += month.actual;
                    acc[month.month].anticipated += month.anticipated;
                    return acc;
                  }, {}))
                }>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={10} angle={-45} textAnchor="end" height={50} />
                  <YAxis tickFormatter={(value) => `${value/1000}k`} fontSize={12} />
                  <Tooltip formatter={(value, name) => [`R${value.toLocaleString()}`, name]} />
                  <Legend />
                  <Bar dataKey="actual" fill="#3B82F6" name="Actual Expenditure" />
                  <Bar dataKey="anticipated" fill="#F97316" name="Anticipated Budget" barSize={0} />
                </BarChart>
              ) : (
                <BarChart data={teamData.months.map(month => {
                  const monthData = { month: month.month };
                  const relevantSpendTypes = teamData[monthlyChartFilter] || [];
                  const totalCategoryBudget = relevantSpendTypes.reduce((sum, s) => sum + s.amount, 0);
                  relevantSpendTypes.forEach(spendType => {
                    const proportion = totalCategoryBudget > 0 ? spendType.amount / totalCategoryBudget : 0;
                    monthData[spendType.name] = month.actual * proportion;
                  });
                  return monthData;
                })}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={10} angle={-45} textAnchor="end" height={50} />
                  <YAxis tickFormatter={(value) => `${value/1000}k`} fontSize={12} />
                  <Tooltip formatter={(value, name) => [`R${value.toLocaleString()}`, name]} />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '10px' }} iconType="circle" iconSize={8} />
                  {(teamData[monthlyChartFilter] || []).map((spendType, index) => (
                    <Bar key={spendType.name} dataKey={spendType.name} stackId="a" name={spendType.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

         {/* Category Bar Chart */}
         <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Spend Type (ZAR)</h3>
          <p className="text-sm text-gray-600 mb-4">Budget allocation by spend type</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={allSpendTypesWithValues}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={80} />
                <YAxis tickFormatter={(value) => `${value/1000}k`} fontSize={12} />
                <Tooltip formatter={(value) => [`R${value.toLocaleString()}`, 'Amount']} />
                <Legend />
                <Bar dataKey="amount" fill="#30b7f6ff" name="Budget Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Budget by Spend Type (%)</h3>
          <p className="text-sm text-gray-600 mb-4">Distribution of budget across spend types</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allSpendTypesWithValues}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {allSpendTypesWithValues.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}%`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Monthly Budget Details</h3>
          <div className="flex gap-4">
            <button
              onClick={handleAddNewMonthClick}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg cursor-pointer hover:bg-green-600 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add Record
            </button>
            <button
              onClick={handleDownloadMonthlyXLSX}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download XLSX
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-[#1F4659] text-white rounded-lg cursor-pointer hover:bg-[#2A5A70] transition-colors">
              <Upload className="w-4 h-4" />
              Upload File
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Date</th>
                <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Category</th>
                <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Main Account Name</th>
                <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Account Entry Description</th>
                <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Document Description</th>
                <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Party Name</th>
                <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Amount</th>
                {/* <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Actions</th> */}
              </tr>
            </thead>
            <tbody>
              {(teamData.actualItems || []).map((item, index) => {
                const isEditing = editingMonthKey === item._id;

                return isEditing ? (
                  <>
                    <tr key={`edit-${index}`} className="bg-blue-50">
                      <td className="border border-gray-200 px-4 py-3">
                        <input
                          type="date"
                          value={editingRecordData.Date ? new Date(editingRecordData.Date).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleDateChangeForEditRecord(e.target.value)}
                          placeholder="YYYY-MM-DD"
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                      <td className="border border-gray-200 px-4 py-3">
                        <input type="text" value={editingRecordData["Account entry description"]} onChange={(e) => setEditingRecordData({...editingRecordData, "Account entry description": e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded" />
                        </td>
                        <td className="border border-gray-200 px-4 py-3">
                          <input type="text" value={editingRecordData["Document Description"]} onChange={(e) => setEditingRecordData({...editingRecordData, "Document Description": e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded" />
                      </td>
                      <td className="border border-gray-200 px-4 py-3">
                      <input type="text" value={newRecord["Document Description"]} onChange={(e) => setNewRecord({...newRecord, "Document Description": e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded" placeholder="Doc Description" />
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                        <select value={editingRecordData["Main Account"]} onChange={(e) => handleAccountChange(e, true)} className="w-full px-2 py-1 border border-gray-300 rounded bg-white">
                          <option value="">Select Account</option>
                          {allAccounts.map(acc => <option key={acc['Main account']} value={acc['Main account']}>{acc['Main account']} - {acc['Main Account Name']}</option>)}
                        </select>
                      </td>
                      <td className="border border-gray-200 px-4 py-3">
                        <input type="text" value={editingRecordData["Party Name"]} onChange={(e) => setEditingRecordData({...editingRecordData, "Party Name": e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded" />
                      </td>
                      <td className="border border-gray-200 px-4 py-3">
                        <input type="text" value={editingRecordData.Category} onChange={(e) => setEditingRecordData({...editingRecordData, Category: e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded" />
                      </td>
                      <td className="border border-gray-200 px-4 py-3">
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">R</span>
                          <input
                            type="number"
                            value={editingRecordData.Amount}
                            onChange={(e) => { setEditingRecordData({ ...editingRecordData, Amount: e.target.value }); if (editMonthError) setEditMonthError(''); }}
                            className="w-full pl-7 pr-2 py-1 border border-gray-300 rounded text-right"
                          />
                        </div>
                      </td>
                      <td className="border border-gray-200 px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={handleSaveUpdatedMonth} className="p-1 text-green-600 hover:text-green-800"><Save className="w-4 h-4" /></button>
                          <button onClick={handleCancelEdit} className="p-1 text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                    {editMonthError && (
                      <tr className="bg-red-50">
                        <td colSpan="7" className="px-4 py-2 text-red-700 text-sm text-center">{editMonthError}</td>
                      </tr>
                    )}
                  </>
                ) : (
                  <tr key={`display-${index}`} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-4 py-3">{item.Date ? new Date(item.Date).toLocaleDateString() : ''}</td>
                    <td className="border border-gray-200 px-4 py-3">{item.Category}</td>
                    <td className="border border-gray-200 px-4 py-3">{item["Main Account Name"]}</td>
                    <td className="border border-gray-200 px-4 py-3">{item["Account entry description"]}</td>
                    <td className="border border-gray-200 px-4 py-3">{item["Document Description"]}</td>
                    <td className="border border-gray-200 px-4 py-3">{item["Party Name"]}</td>
                    <td className="border border-gray-200 px-4 py-3">R{Number(item.Amount || 0).toLocaleString()}</td>
                    {/* <td className="border border-gray-200 px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleEditMonthClick(item)} className="p-1 text-blue-600 hover:text-blue-800"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteMonth(item)} className="p-1 text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td> */}
                  </tr>
                );
              })}
              {isAddingMonth && (
                <>
                  <tr className="bg-green-50">
                    <td className="border border-gray-200 px-4 py-3">
                      <input
                        type="date"
                        value={newRecord.Date}
                        onChange={(e) => { handleDateChangeForNewRecord(e.target.value); if (addMonthError) setAddMonthError(''); }}
                        placeholder="YYYY-MM-DD"
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <input type="text" value={newRecord["Account entry description"]} onChange={(e) => setNewRecord({...newRecord, "Account entry description": e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded" placeholder="Description" />
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <select
                        value={newRecord["Main Account"]}
                        onChange={(e) => handleAccountChange(e, false)}
                        className="w-full px-2 py-1 border border-gray-300 rounded bg-white"
                      >
                        <option value="">Select Account</option>
                        {allAccounts.map(acc => <option key={acc['Main account']} value={acc['Main account']}>{acc['Main account']} - {acc['Main Account Name']}</option>)}
                      </select>
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <input type="text" value={newRecord["Party Name"]} onChange={(e) => setNewRecord({...newRecord, "Party Name": e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded" placeholder="Party Name" />
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <input type="text" value={newRecord.Category} onChange={(e) => setNewRecord({...newRecord, Category: e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded" placeholder="Category" />
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">R</span>
                        <input
                          type="number"
                          value={newRecord.Amount}
                          onChange={(e) => { setNewRecord({ ...newRecord, Amount: e.target.value }); if (addMonthError) setAddMonthError(''); }}
                          placeholder="0"
                          className="w-full pl-7 pr-2 py-1 border border-gray-300 rounded text-right"
                        />
                      </div>
                    </td>
                    <td className="border border-gray-200 px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={handleSaveNewMonth} className="p-1 text-green-600 hover:text-green-800"><Save className="w-4 h-4" /></button>
                        <button onClick={() => { setIsAddingMonth(false); setAddMonthError(''); setNewRecord({ Date: "", "Account entry description": "", "Main Account": "", "Main Account Name": "", Amount: "", "Party Name": "", "Document Description": "", Category: "", spendType: "" }); }} className="p-1 text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                  {addMonthError && (
                    <tr className="bg-red-50">
                      <td colSpan="9" className="px-4 py-2 text-red-700 text-sm text-center">{addMonthError}</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Details Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Spend Type Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Spend Type</th>
                <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Percentage</th>
                <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {allSpendTypesWithValues.map((spendItem, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-4 py-3">{teamData.people.some(p => p.name === spendItem.name) ? 'People' : 'Programs'}</td>
                  <td className="border border-gray-200 px-4 py-3">{spendItem.value}%</td>
                  <td className="border border-gray-200 px-4 py-3">R{spendItem.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default BudgetExpensePage;