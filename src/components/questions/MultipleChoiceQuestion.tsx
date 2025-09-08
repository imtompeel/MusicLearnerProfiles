import React from 'react';
import type { MusicQuestion } from '../../types';
import { playNote, noteToFrequency } from '../../utils/audio';

interface MultipleChoiceQuestionProps {
  question: MusicQuestion;
  preferences: { [key: string]: any };
  onSelectPreference: (questionId: string, value: any) => void;
}

export const MultipleChoiceQuestion: React.FC<MultipleChoiceQuestionProps> = ({
  question,
  preferences,
  onSelectPreference
}) => {
  const handleSelectPreference = (option: string, element: HTMLElement) => {
    if (question.question_type === 'multiple') {
      // Handle multiple selection
      const current = preferences[question.question_number] || [];
      const currentArray = Array.isArray(current) ? current : [];
      const index = currentArray.indexOf(option);
      
      let newValue;
      if (index > -1) {
        // Remove from selection
        const newArray = [...currentArray];
        newArray.splice(index, 1);
        newValue = newArray;
        element.classList.remove('selected');
      } else {
        // Add to selection
        const newArray = [...currentArray, option];
        newValue = newArray;
        element.classList.add('selected');
      }
      
      onSelectPreference(question.question_number, newValue);
    } else {
      // Handle single selection
      onSelectPreference(question.question_number, option);
      
      // Update visual selection
      const container = element.closest('.preference-options');
      if (container) {
        container.querySelectorAll('.preference-card').forEach(card => {
          card.classList.remove('selected');
        });
      }
      element.classList.add('selected');
      
      // Auto-advance to next question after a delay
      setTimeout(() => {
        // This will be handled by the parent component
      }, 1000);
    }
    
    playNote(noteToFrequency('C5'), 0.3);
  };

  return (
    <>
      <div className="preference-question">
        <h3>{question.question_text}</h3>
      </div>
      <div className="preference-options">
        {[1, 2, 3, 4].map(i => {
          const option = question[`option${i}` as keyof MusicQuestion] as string;
          const emoji = question[`emoji${i}` as keyof MusicQuestion] as string;
          if (!option) return null;
          
          const isSelected = question.question_type === 'multiple' 
            ? (preferences[question.question_number] && 
               Array.isArray(preferences[question.question_number]) && 
               (preferences[question.question_number] as string[]).includes(option))
            : (preferences[question.question_number] === option);
          
          return (
            <div 
              key={i}
              className={`preference-card ${isSelected ? 'selected' : ''}`}
              onClick={(e) => handleSelectPreference(option, e.currentTarget)}
            >
              <div className="emoji">{emoji}</div>
              <div className="question">{option}</div>
              {question.question_type === 'multiple' && (
                <div className="checkbox">
                  {isSelected ? '☑' : '☐'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};
