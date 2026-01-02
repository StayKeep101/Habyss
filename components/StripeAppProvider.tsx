import React from 'react';
import { StripeProvider as StripeProviderNative } from '@stripe/stripe-react-native';

export default function StripeAppProvider({ children }: { children: React.ReactNode }) {
    const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
        console.warn('Stripe publishable key is missing. Stripe features will not work.');
    }

    return (
        <StripeProviderNative
            publishableKey={publishableKey || ''}
            merchantIdentifier="merchant.com.yourcompany.habyss"
        >
            {children}
        </StripeProviderNative>
    );
}
