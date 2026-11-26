import { router } from 'expo-router';
import { ProPage } from '@/components/Pro/ProPage';

/** Habyss Pro: desktop sync, the one thing for sale (components/Pro/ProPage). */
export default function ProScreen() {
    return <ProPage onClose={() => router.back()} />;
}
