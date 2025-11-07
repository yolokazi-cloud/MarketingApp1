import React, { useState, useEffect } from 'react';
import BudgetOverview from './BudgetOverview';
import BudgetExpensePage from './BudgetExpensePage';
import logo from './Altron Logo - Light 2x.png';
import { Menu, X } from 'lucide-react';

const App = () => {
  const [budgetData, setBudgetData] = useState(null); // Initial state is null
  const [allAccounts, setAllAccounts] = useState([]);
  const [currentView, setCurrentView] = useState('overview');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const budgetResponse = await fetch('https://marketingapp1.onrender.com/api/budget');
      if (!budgetResponse.ok) {
        throw new Error(`HTTP error! status: ${budgetResponse.status}`);
      }
      const budgetResult = await budgetResponse.json();
      setBudgetData(budgetResult);

      const accountsResponse = await fetch('https://marketingapp1.onrender.com/api/accounts'); // Assuming an endpoint to get all accounts
      if (accountsResponse.ok) {
        const accountsResult = await accountsResponse.json();
        setAllAccounts(accountsResult);
      }
    } catch (e) {
      setError(e.message);
      console.error("Failed to fetch budget data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []); // Empty dependency array means this runs once on mount
  
  const handleTeamSelect = (team) => {
    setSelectedTeam(team); // This will automatically switch the view if needed
    setCurrentView('expenses'); // Explicitly switch to details view
  };
  
  const handleUpload = (data) => {
    console.log('Uploaded data:', data);
    // Here you could process the uploaded CSV data and update the anticipatedBudgetData
  };

  const handleDataUpdate = () => {
    // This function now triggers a refetch of all data from the backend
    console.log('Data update triggered. Refetching all budget data...');
    fetchData();
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center h-full">Loading...</div>;
    }
    if (error) {
      return <div className="flex justify-center items-center h-full text-red-500">Error: {error}</div>;
    }
    if (!budgetData || Object.keys(budgetData).length === 0) {
      return (
        <div className="flex justify-center items-center h-full text-center">
          <div className="p-6 bg-gray-50 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-700">No Budget Data Found</h2>
            <p className="mt-2 text-gray-500">Please check the backend server and database connection.</p>
          </div>
        </div>
      );
    }

    if (currentView === 'overview') {
      return (
        <BudgetOverview
          budgetData={budgetData}
          selectedTeam={selectedTeam}
          setBudgetData={setBudgetData}
          onTeamSelect={handleTeamSelect}
          onDataUpdate={handleDataUpdate}
        />
      );
    }

    // This is for the 'expenses' view
    return (
      <BudgetExpensePage
        selectedTeam={selectedTeam}
        onUpload={handleUpload}
        budgetData={budgetData}
        setBudgetData={setBudgetData}
        allAccounts={allAccounts}
        onDataUpdate={handleDataUpdate}
      />
    );
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-30">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md bg-[#1F4659] text-white">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-20 w-80 bg-[#1F4659] text-white p-6 overflow-y-auto transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:flex lg:flex-col`}>
        <div className="mb-0">
          <img src={logo} alt="Altron Logo" className="h-20 mx-auto" />
        </div>
        <nav className="mt-4 space-y-4">
          <div>
            <button
              onClick={() => { setCurrentView('overview'); setSelectedTeam(null); setIsSidebarOpen(false); }}
              className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${currentView === 'overview' ? 'bg-white text-[#1F4659]' : 'hover:bg-[#2A5A70] text-white'}`}
            >
              Group Overview
            </button>
          </div>
          {budgetData && Object.keys(budgetData).length > 0 && (
            <>
              <h2 className="text-2xl text-yellow-200 font-semibold pt-2 p-3">Cost Centers</h2>
              {Object.keys(budgetData).filter(key => key !== 'financialYear').map((costCenter) => (
                <button
                  key={costCenter}
                  onClick={() => {
                    setSelectedTeam(costCenter);
                    setCurrentView('expenses');
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${selectedTeam === costCenter && currentView === 'expenses' ? 'bg-white text-[#1F4659]' : 'hover:bg-[#2A5A70] text-white'}`}
                >
                  {budgetData[costCenter].teamName || costCenter}
                </button>
              ))}
            </>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pt-16 lg:pt-0">
        {renderContent()}
      </div>
    </div>
  );
};

export default App;
