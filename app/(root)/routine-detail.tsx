// Keep old deep links safe after removing routines from the app.
import React from 'react';
import { Redirect } from 'expo-router';
export default function RetiredRoutineScreen() {
    return <Redirect href="/(root)/(tabs)/roadmap" />;
}
