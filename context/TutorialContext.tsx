import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TutorialContextType {
    isActive: boolean;
    startTutorial: () => void;
    endTutorial: () => void;
    step: number;
    nextStep: () => void;
}

const TutorialContext = createContext<TutorialContextType>({
    isActive: false,
    startTutorial: () => { },
    endTutorial: () => { },
    step: 0,
    nextStep: () => { },
});

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isActive, setIsActive] = useState(false);
    const [step, setStep] = useState(0);

    const startTutorial = () => {
        setIsActive(true);
        setStep(0);
    };

    const endTutorial = () => {
        setIsActive(false);
        setStep(0);
        AsyncStorage.setItem('has_seen_tutorial', 'true');
    };

    const nextStep = () => {
        setStep((prev) => prev + 1);
    };

    return (
        <TutorialContext.Provider value={{ isActive, startTutorial, endTutorial, step, nextStep }}>
            {children}
        </TutorialContext.Provider>
    );
};

export const useTutorial = () => useContext(TutorialContext);
