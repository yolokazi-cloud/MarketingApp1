import React, { useState, useMemo ,useEffect} from 'react';
import { X, Download, Trash2, Edit, Save, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

const UploadHistoryModal = ({ isOpen, onClose, dataType, onDataUpdate }) => {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null); // { index, data }
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // Holds versionId to delete
  const [error, setError] = useState('');

  const title = dataType.charAt(0).toUpperCase() + dataType.slice(1);

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    } else {
      // Reset state when modal is closed
      setVersions([]);
      setSelectedVersion(null);
      setEditingRecord(null);
      setDeleteConfirmation(null);
      setError('');
    }
  }, [isOpen, dataType]);

  const fetchVersions = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`https://marketingapp1.onrender.com/api/uploads/${dataType}/versions`);
      if (!response.ok) throw new Error('Failed to fetch versions.');
      const data = await response.json();
      setVersions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewVersion = async (versionId) => {
    // If already selected, collapse it
    if (selectedVersion && selectedVersion._id === versionId) {
      setSelectedVersion(null);
      setEditingRecord(null);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`https://marketingapp1.onrender.com/api/uploads/${dataType}/versions/${versionId}`);
      if (!response.ok) throw new Error('Failed to load version data.');
      const data = await response.json();
      setSelectedVersion(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVersion = async (versionId) => {
    try {
      const response = await fetch(`https://marketingapp1.onrender.com/api/uploads/${dataType}/versions/${versionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete version.');
      
      setDeleteConfirmation(null); // Close confirmation modal
      fetchVersions(); // Refresh versions list
      
      // If the deleted version was the selected one, clear the view
      if (selectedVersion && selectedVersion._id === versionId) {
        setSelectedVersion(null);
      }
      // Refresh the main page data as the underlying collection has been rebuilt
      onDataUpdate();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDownloadVersion = async (version) => {
    try {
      let versionData = version.data;

      // If the data isn't already loaded (i.e., it's not the currently selected version), fetch it.
      if (!versionData) {
        const response = await fetch(`https://marketingapp1.onrender.com/api/uploads/${dataType}/versions/${version._id}`);
        if (!response.ok) throw new Error('Failed to load version data for download.');
        const fullVersion = await response.json();
        versionData = fullVersion.data;
      }

      const worksheet = XLSX.utils.json_to_sheet(versionData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      XLSX.writeFile(workbook, `${dataType}_v${version.versionNumber}_${version.fileName}`);
    } catch (err) {
      alert(`Error preparing download: ${err.message}`);
    }
  };

  const handleSaveRecord = async () => {
    if (!selectedVersion || editingRecord === null) return;

    try {
      const response = await fetch(`https://marketingapp1.onrender.com/api/uploads/${dataType}/versions/${selectedVersion._id}/records/${editingRecord.index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRecord.data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to save record.');
      }

      const { record: savedRecord } = await response.json();

      // Update local state to show the change immediately
      const updatedData = [...selectedVersion.data];
      updatedData[editingRecord.index] = savedRecord; // Use the saved record from the backend response
      setSelectedVersion({ ...selectedVersion, data: updatedData });

      setEditingRecord(null); // Exit editing mode
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };
  
//   const handleEditChange = (e, key) => {
//     setEditingRecord({
//       ...editingRecord,
//       data: {
//         ...editingRecord.data,
//         [key]: e.target.value,
//       },
//     });
//   };

const renderRecordRow = (record, index) => {
  //  const isEditing = editingRecord && editingRecord.index === index;
    
    //if (isEditing) {
    //  return (
        // <tr key={`edit-${index}`} className="bg-blue-50">
        //   {tableHeaders.map(header => (
        //     <td key={header} className="border border-gray-200 px-2 py-1">
        //       <input
        //         type="text"
        //         value={editingRecord.data[header] != null ? editingRecord.data[header] : ''}
        //         onChange={(e) => handleEditChange(e, header)}
        //         className="w-full px-2 py-1 border border-gray-300 rounded"
        //       />
        //     </td>
        //   ))}
        //   <td className="border border-gray-200 px-2 py-1">
        //     <div className="flex gap-2">
        //       <button onClick={handleSaveRecord} className="p-1 text-green-600 hover:text-green-800"><Save className="w-4 h-4" /></button>
        //       <button onClick={() => setEditingRecord(null)} className="p-1 text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button>
        //     </div>
        //   </td>
        // </tr>
//);
 //   }

    return (
      <tr key={`display-${index}`} className="hover:bg-gray-50">
        {tableHeaders.map(header => (
          <td key={header} className="border border-gray-200 px-2 py-1 text-sm">{String(record[header] != null ? record[header] : '')}</td>
        ))}
      {/*   <td className="border border-gray-200 px-2 py-1">
          <div className="flex gap-2">
            <button 
              onClick={() => setEditingRecord({ index, data: record })} 
              className="p-1 text-blue-600 hover:text-blue-800" 
              title="Upcoming feature"><Edit className="w-4 h-4" /></button>
          </div>
        </td>*/ }
      </tr>
    );
  };

  // Create a comprehensive set of headers from all records to handle inconsistent key ordering.
  const tableHeaders = useMemo(() => {
    if (!isOpen || !selectedVersion || !selectedVersion.data || selectedVersion.data.length === 0) {
      return [];
    }
    const allKeys = new Set();
    selectedVersion.data.forEach(record => {
      if (record) Object.keys(record).forEach(key => allKeys.add(key));
    });
    return Array.from(allKeys);
  }, [isOpen, selectedVersion]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-2xl font-bold text-[#1F4659]">{title} Upload History</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-grow">
          {isLoading && <p>Loading...</p>}
          {error && <p className="text-red-500">{error}</p>}
          
          <div className="space-y-2">
            {versions.map(version => (
              <div key={version._id} className="border rounded-lg">
                <div className="flex items-center justify-between p-3 bg-gray-50">
                  <div className="font-semibold">
                    Version {version.versionNumber}: <span className="font-normal text-gray-600">{version.fileName}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(version.uploadDate).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleViewVersion(version._id)} className="flex items-center gap-1 text-blue-600 hover:underline">
                      {selectedVersion && selectedVersion._id === version._id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      View Data
                    </button>
                    <button onClick={() => handleDownloadVersion(version)} className="p-1 text-gray-600 hover:text-blue-700" title="Download Version">
                      <Download size={18} />
                    </button>
                    <button onClick={() => setDeleteConfirmation(version._id)} className="p-1 text-gray-600 hover:text-red-700" title="Delete Version">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {selectedVersion && selectedVersion._id === version._id && (
                  <div className="p-4 border-t">
                    <h4 className="text-lg font-semibold mb-2">Data for Version {selectedVersion.versionNumber}</h4>
                    <div className="overflow-x-auto max-h-[50vh]">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-100">
                            {tableHeaders.map(header => (
                              <th key={header} className="border border-gray-200 px-2 py-2 text-left font-semibold sticky top-0 bg-gray-100">{header}</th>
                            ))}
                             {/* <th className="border border-gray-200 px-2 py-2 text-left font-semibold sticky top-0 bg-gray-100">Actions</th>  */}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedVersion.data.map(renderRecordRow)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {deleteConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Delete Upload Version</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">Are you sure you want to delete this version? This will permanently remove the version and rebuild the main data from the remaining uploads. This action cannot be undone.</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button onClick={() => handleDeleteVersion(deleteConfirmation)} type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">Delete</button>
                <button onClick={() => setDeleteConfirmation(null)} type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadHistoryModal;

