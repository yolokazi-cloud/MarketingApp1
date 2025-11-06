import React, { useState, useMemo } from 'react';
import { Upload, DollarSign, TrendingUp, History, AlertTriangle, CheckCircle } from 'lucide-react';
import { TeamBudgetChart } from './TeamBudgetChart';
import UploadHistoryModal from './UploadHistoryModal';

const BudgetOverview = ({budgetData, onDataUpdate }) => {
  const costCenters = Object.keys(budgetData).filter(key => key !== 'financialYear');
  const [primaryFilter, setPrimaryFilter] = useState('all'); // 'all', 'People', 'Programs'
  const [selectedSpendTypes, setSelectedSpendTypes] = useState([]);
  const [teamChartFilters, setTeamChartFilters] = useState({}); // Local filters for each team chart
  const [historyModal, setHistoryModal] = useState({ isOpen: false, dataType: '' });
  const [notification, setNotification] = useState({ isOpen: false, message: '', type: '' }); // 'success' or 'error'

  const handlePrimaryFilterChange = (e) => {
    const newFilter = e.target.value;
    setPrimaryFilter(newFilter);
    setSelectedSpendTypes([]); // Reset spend type checkboxes when primary filter changes
    // If the main filter is set back to 'All', reset all individual chart filters to 'all'
    if (newFilter.toLowerCase() === 'all') {
      setTeamChartFilters({});
    }
  };

  const handleSpendTypeChange = (spendType) => {
    setSelectedSpendTypes(prev => 
      prev.includes(spendType) 
        ? prev.filter(s => s !== spendType) 
        : [...prev, spendType]
    );
  };

  const handleTeamFilterChange = (teamName, filter) => {
    setTeamChartFilters(prev => ({
      ...prev,
      [teamName]: filter,
    }));
  };

  // Memoize the list of all unique spend types for the filter checkboxes
  const allUniqueSpendTypes = useMemo(() => {
    const spendTypes = new Set();
    const filterKey = primaryFilter.toLowerCase();
    costCenters.forEach(cc => {
      if (filterKey === 'all') {
        (budgetData[cc]['people'] || []).forEach(item => spendTypes.add(item.name));
        (budgetData[cc]['programs'] || []).forEach(item => spendTypes.add(item.name));
      } else {
        (budgetData[cc][filterKey] || []).forEach(item => spendTypes.add(item.name));
      }
    });
    return Array.from(spendTypes);
  }, [budgetData, costCenters, primaryFilter]);

  const handleFileUpload = async (event, dataType) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const endpoint = `http://localhost:3001/api/upload/${dataType}s`; // FIX: Use plural 'actuals' or 'anticipateds'

    try {
      const response = await window.fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        // Try to parse the error response as JSON
        const errorData = await response.json().catch(() => null);
        if (errorData && errorData.errors) {
          let errorMessage = errorData.message || 'File validation failed.';
          errorMessage += '\n\nPlease correct the following:\n' + errorData.errors.map(err => `- ${err}`).join('\n');
          throw new Error(errorMessage);
        }
        throw new Error(errorData?.message || `Failed to upload ${dataType} data. Status: ${response.status}`);
      }

      const result = await response.json();
      let successMessage = result.message;
      if (result.corrections && result.corrections.length > 0) {
        successMessage += '\n\nThe following corrections were made automatically:\n' +
          result.corrections.map(c => `- ${c}`).join('\n');
      }
      setNotification({ isOpen: true, message: successMessage, type: 'success' });
      onDataUpdate(); 
    } catch (error) {
      console.error('Upload failed:', error);
      setNotification({ isOpen: true, message: error.message, type: 'error' });
    }

    event.target.value = null; // Reset file input
  };
  
  return (
    // The main flex container and sidebar have been removed from this component.
    // It now only renders the main content, which will be placed inside the layout from App.js.
    <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-[#1F4659]">Group Budget Overview</h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
              <Upload className="w-4 h-4" />
              <span>Upload Actuals</span>
              <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => handleFileUpload(e, 'actual')} className="hidden" />
            </label>
            <button 
              onClick={() => setHistoryModal({ isOpen: true, dataType: 'actuals' })}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
              title="View Actuals Upload History"
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>
            
            <div className="border-l border-gray-300 h-8 mx-2"></div>

            <label className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg cursor-pointer hover:bg-orange-600 transition-colors">
              <Upload className="w-4 h-4" />
              <span>Upload Anticipated</span>
              <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => handleFileUpload(e, 'anticipated')} className="hidden" />
            </label>
            <button 
              onClick={() => setHistoryModal({ isOpen: true, dataType: 'anticipateds' })}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
              title="View Anticipateds Upload History"
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>
          </div>
        </div>
        
        {/* Filter Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-4">
            <label htmlFor="primaryFilter" className="font-medium text-gray-700">Filter by:</label>
            <select id="primaryFilter" value={primaryFilter} onChange={handlePrimaryFilterChange} className="border rounded p-2">
              <option value="all">All Spend Types</option>
              <option value="People">People</option>
              <option value="Programs">Programs</option>
            </select>
          </div>
          <div className="mt-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {allUniqueSpendTypes.map(spendType => (
                <label key={spendType} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-600">
                  <input 
                    type="checkbox" 
                    checked={selectedSpendTypes.includes(spendType)}
                    onChange={() => handleSpendTypeChange(spendType)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {spendType}
                </label>
              ))}
            </div>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {useMemo(() => {
              // This logic now correctly calculates totals based on the selected filters.
              let totalAnticipated = 0;

              // Determine which spend types to include based on filters
              const spendTypesToSum = selectedSpendTypes.length > 0 
                ? selectedSpendTypes 
                : allUniqueSpendTypes;

              costCenters.forEach(cc => {
                const teamData = budgetData[cc];
                if (!teamData) return;

                const people = teamData.people || [];
                const programs = teamData.programs || [];

                const filterKey = primaryFilter.toLowerCase();

                // Sum amounts from the 'people' category if relevant
                if (filterKey === 'all' || filterKey === 'people') {
                  people.forEach(item => {
                    if (spendTypesToSum.includes(item.name)) totalAnticipated += item.amount;
                  });
                }
                // Sum amounts from the 'programs' category if relevant
                if (filterKey === 'all' || filterKey === 'programs') {
                  programs.forEach(item => {
                    if (spendTypesToSum.includes(item.name)) totalAnticipated += item.amount;
                  });
                }
              });

              // Correctly calculate totalActual by summing the 'Amount' from every row in 'actualItems' across all cost centers.
              const totalActual = costCenters.reduce((total, cc) => {
                const teamData = budgetData[cc];
                const teamActualTotal = (teamData.actualItems || []).reduce((sum, item) => sum + (item.Amount || 0), 0);
                return total + teamActualTotal;
              }, 0);

              const variance = totalActual - totalAnticipated;
              const averageMonthly = totalActual / 12;
              return (
              <>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-600">Total Actual</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">R{totalActual.toLocaleString()}</span>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-600">Total Anticipated</span>
                  </div>
                  <span className="text-2xl font-bold text-orange-600">R{totalAnticipated.toLocaleString()}</span>
                </div>
                <div className={`p-4 rounded-lg ${variance >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className={`w-5 h-5 ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`} />
                    <span className={`text-sm font-medium ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>Total Variance</span>
                  </div>
                  <span className={`text-2xl font-bold ${variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    R{Math.abs(variance).toLocaleString()}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-600">Avg Monthly</span>
                  </div>
                  <span className="text-2xl font-bold text-gray-600">R{Math.round(averageMonthly).toLocaleString()}</span>
                </div>
              </>
              );
          }, [budgetData, costCenters, primaryFilter, selectedSpendTypes, allUniqueSpendTypes])}
        </div>
        
        {/* Cost Center Budget Charts - 3 per row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {costCenters.map((costCenter) => {
            const teamData = budgetData[costCenter];
            // Add a guard to ensure teamData exists before rendering the card
            if (!teamData) return null;

            // The main filter now controls the individual chart filters.
            const currentFilter = primaryFilter.toLowerCase() === 'all'
              ? (teamChartFilters[costCenter] || 'all')
              : primaryFilter.toLowerCase();

            return (
              <div key={costCenter} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex flex-col">
                <div className="flex justify-between items-start mb-2 h-20">
                  <h3 className={`font-semibold text-gray-800 ${
                      teamData.teamName.length > 25 ? 'text-base' : 'text-lg'
                    }`}
                  >
                    {teamData.teamName}
                  </h3>
                  <div className="flex border border-gray-200 rounded-md p-0.5">
                    {['All', 'People', 'Programs'].map(filter => (
                      <button
                        key={filter}
                        onClick={() => handleTeamFilterChange(costCenter, filter.charAt(0).toLowerCase() + filter.slice(1))}
                        className={`px-2 py-0.5 text-xs rounded-sm transition-colors ${
                          currentFilter === (filter.charAt(0).toLowerCase() + filter.slice(1)) ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                        }`}
                      >{filter}</button>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">{currentFilter === 'all' ? 'Actual vs. Anticipated Spend' : `Monthly spend breakdown for ${currentFilter}.`}</p>
                <div className="h-64 mb-4">
                  <TeamBudgetChart teamData={teamData} currentFilter={currentFilter} />
                </div>
                
                {/* Team Summary */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-blue-50 p-2 rounded">
                    <div className="text-blue-600 font-medium">Total Actual</div>
                    <div className="text-blue-800 font-semibold">R{teamData.months.reduce((sum, month) => sum + month.actual, 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-orange-50 p-2 rounded">
                    <div className="text-orange-600 font-medium">Total Anticipated</div>
                    <div className="text-orange-800 font-semibold">R{teamData.months.reduce((sum, month) => sum + month.anticipated, 0).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <UploadHistoryModal
          isOpen={historyModal.isOpen}
          onClose={() => setHistoryModal({ isOpen: false, dataType: '' })}
          dataType={historyModal.dataType}
          onDataUpdate={onDataUpdate}
        />

        {notification.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex items-start">
                <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${notification.type === 'error' ? 'bg-red-100' : 'bg-green-100'} sm:mx-0 sm:h-10 sm:w-10`}>
                  {notification.type === 'error' ? (
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  )}
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {notification.type === 'error' ? 'Upload Failed' : 'Upload Successful'}
                  </h3>
                  <div className="mt-2 max-h-60 overflow-y-auto">
                    <p className="text-sm text-gray-500 whitespace-pre-wrap pr-4">
                      {notification.message}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button onClick={() => setNotification({ isOpen: false, message: '', type: '' })} type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#1F4659] text-base font-medium text-white hover:bg-[#2A5A70] focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">OK</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default BudgetOverview;