import { router } from 'expo-router';
import { Paywall } from '@/components/Paywall/Paywall';

export default function PaywallScreen() {
    return <Paywall mode="open" onClose={() => router.back()} />;
}
