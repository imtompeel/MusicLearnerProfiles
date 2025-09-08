import React, { useState } from 'react';
import type { ClassData, CurrentClass } from '../types';
import { useClasses } from '../hooks/useClasses';
import { useStatus } from '../hooks/useStatus';

interface ClassSelectionProps {
  onClassSelect: (currentClass: CurrentClass) => void;
  onSessionSelect: (session: string) => void;
}

export const ClassSelection: React.FC<ClassSelectionProps> = ({
  onClassSelect,
  onSessionSelect
}) => {
  const { classes, loading, error, addNewClass, updateExistingClass, removeClass, refreshClasses } = useClasses();
  const { showSuccess, showError } = useStatus();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [showClassManagement, setShowClassManagement] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSoI, setNewClassSoI] = useState('R3.1');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassSoI, setEditClassSoI] = useState('');

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const className = e.target.value;
    setSelectedClass(className);
    
    if (className) {
      const classData = classes.find(c => c.class_name === className);
      if (classData) {
        const currentClass: CurrentClass = {
          name: classData.class_name,
          soiMedian: classData.soi_median
        };
        onClassSelect(currentClass);
      }
    }
  };

  const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const session = e.target.value;
    setSelectedSession(session);
    onSessionSelect(session);
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) {
      showError('Please enter a class name');
      return;
    }
    
    if (classes.find(c => c.class_name === newClassName)) {
      showError('Class already exists');
      return;
    }
    
    const newClass: ClassData = {
      class_name: newClassName.trim(),
      soi_median: newClassSoI
    };
    
    try {
      await addNewClass(newClass);
      setNewClassName('');
      setNewClassSoI('R3.1');
      showSuccess(`Class "${newClassName}" added successfully!`);
    } catch (err) {
      showError('Failed to add class. Please try again.');
    }
  };

  const handleEditClass = (index: number) => {
    const classData = classes[index];
    setEditingIndex(index);
    setEditClassName(classData.class_name);
    setEditClassSoI(classData.soi_median);
  };

  const handleSaveEdit = async (index: number) => {
    if (!editClassName.trim()) {
      showError('Please enter a class name');
      return;
    }
    
    // Check if the new name conflicts with existing classes (excluding the current one being edited)
    const existingClass = classes.find((c, i) => c.class_name === editClassName.trim() && i !== index);
    if (existingClass) {
      showError('A class with this name already exists');
      return;
    }
    
    const updatedClass: ClassData = {
      class_name: editClassName.trim(),
      soi_median: editClassSoI
    };
    
    try {
      await updateExistingClass(index, updatedClass);
      setEditingIndex(null);
      setEditClassName('');
      setEditClassSoI('');
      showSuccess(`Class "${editClassName}" updated successfully!`);
    } catch (err) {
      showError('Failed to update class. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditClassName('');
    setEditClassSoI('');
  };

  const handleDeleteClass = async (index: number) => {
    if (confirm('Are you sure you want to delete this class?')) {
      const deletedClass = classes[index];
      try {
        await removeClass(index);
        showSuccess(`Class "${deletedClass.class_name}" deleted successfully!`);
      } catch (err) {
        showError('Failed to delete class. Please try again.');
      }
    }
  };

  const toggleClassManagement = () => {
    setShowClassManagement(!showClassManagement);
  };

  return (
    <div className="class-selection">
      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '10px' }}>
          ⚠️ {error}
        </div>
      )}
      <div className="class-selector">
        <div className="selector-group">
          <label htmlFor="classSelect">Select Class:</label>
          <select 
            id="classSelect" 
            value={selectedClass}
            onChange={handleClassChange}
            disabled={loading}
          >
            <option value="">{loading ? 'Loading classes...' : 'Choose a class...'}</option>
            {classes.map((classData, index) => (
              <option key={index} value={classData.class_name}>
                {classData.class_name}
              </option>
            ))}
          </select>
        </div>
        <div className="selector-group">
          <label htmlFor="sessionSelect">Select Session:</label>
          <select 
            id="sessionSelect" 
            value={selectedSession}
            onChange={handleSessionChange}
          >
            <option value="">Choose a session...</option>
            <option value="Music Who Are You?">Music Who Are You?</option>
            <option value="Freesound Session">Freesound Session</option>
            <option value="My Creativity">My Creativity</option>
            <option value="Class Planning Session">Class Planning Session</option>
            <option value="Sound Matching Session">Sound Matching Session</option>
          </select>
        </div>
        <button 
          className="btn-teacher" 
          onClick={refreshClasses}
          disabled={loading}
        >
          {loading ? '⏳ Loading...' : '🔄 Refresh Classes'}
        </button>
        <button 
          className="btn-teacher" 
          onClick={toggleClassManagement}
        >
          📚 {showClassManagement ? 'Hide Classes' : 'Manage Classes'}
        </button>
      </div>
      
      {showClassManagement && (
        <div className="class-management">
          <h4>📚 Class Management</h4>
          <div className="class-input-group">
            <input 
              type="text" 
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Class name (e.g., Challenge1)" 
              className="class-input"
            />
            <select 
              value={newClassSoI}
              onChange={(e) => setNewClassSoI(e.target.value)}
              className="soi-select"
            >
              <option value="R1.1">R1.1 - Sound Awareness</option>
              <option value="R2.1">R2.1 - Pattern Recognition</option>
              <option value="R3.1">R3.1 - Musical Phrases</option>
              <option value="R4.1">R4.1 - Musical Motifs</option>
              <option value="R5.1">R5.1 - Complete Pieces</option>
              <option value="R6">R6 - Cultural Understanding</option>
            </select>
            <button 
              className="btn-teacher" 
              onClick={handleAddClass}
            >
              ➕ Add Class
            </button>
          </div>
          <div className="class-list">
            {classes.map((classData, index) => (
              <div key={index} className="class-item">
                {editingIndex === index ? (
                  <div className="class-edit-form">
                    <div className="class-input-group">
                      <input 
                        type="text" 
                        value={editClassName}
                        onChange={(e) => setEditClassName(e.target.value)}
                        placeholder="Class name" 
                        className="class-input"
                      />
                      <select 
                        value={editClassSoI}
                        onChange={(e) => setEditClassSoI(e.target.value)}
                        className="soi-select"
                      >
                        <option value="R1.1">R1.1 - Sound Awareness</option>
                        <option value="R2.1">R2.1 - Pattern Recognition</option>
                        <option value="R3.1">R3.1 - Musical Phrases</option>
                        <option value="R4.1">R4.1 - Musical Motifs</option>
                        <option value="R5.1">R5.1 - Complete Pieces</option>
                        <option value="R6">R6 - Cultural Understanding</option>
                      </select>
                      <button 
                        className="btn-save" 
                        onClick={() => handleSaveEdit(index)}
                      >
                        ✅ Save
                      </button>
                      <button 
                        className="btn-cancel" 
                        onClick={handleCancelEdit}
                      >
                        ❌ Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="class-item-info">
                      <div className="class-item-name">{classData.class_name}</div>
                      <div className="class-item-soi">SoI Level: {classData.soi_median}</div>
                    </div>
                    <div className="class-item-actions">
                      <button 
                        className="btn-edit" 
                        onClick={() => handleEditClass(index)}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        className="btn-delete" 
                        onClick={() => handleDeleteClass(index)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {selectedClass && (
        <div className="class-info">
          <strong>{selectedClass}</strong> - SoI Level: {classes.find(c => c.class_name === selectedClass)?.soi_median}
        </div>
      )}
    </div>
  );
};
