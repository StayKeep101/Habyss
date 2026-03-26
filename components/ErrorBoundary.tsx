import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in the component tree
 * and displays a fallback UI instead of crashing the app
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error details
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // You can log to an error reporting service here
        // Example: Sentry.captureException(error, { extra: errorInfo });

        this.setState({
            error,
            errorInfo,
        });
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="alert-circle" size={64} color="#EF4444" />
                        </View>

                        <Text style={styles.title}>Oops! Something went wrong</Text>

                        <Text style={styles.subtitle}>
                            The app encountered an unexpected error. Don't worry, your data is safe.
                        </Text>

                        {__DEV__ && this.state.error && (
                            <ScrollView style={styles.errorDetailsContainer}>
                                <Text style={styles.errorDetailsTitle}>Error Details (Dev Only):</Text>
                                <Text style={styles.errorDetailsText}>
                                    {this.state.error.toString()}
                                </Text>
                                {this.state.errorInfo && (
                                    <Text style={styles.errorDetailsText}>
                                        {this.state.errorInfo.componentStack}
                                    </Text>
                                )}
                            </ScrollView>
                        )}

                        <TouchableOpacity
                            style={styles.button}
                            onPress={this.handleReset}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="refresh" size={20} color="#fff" style={styles.buttonIcon} />
                            <Text style={styles.buttonText}>Try Again</Text>
                        </TouchableOpacity>

                        <Text style={styles.helpText}>
                            If this problem persists, please restart the app
                        </Text>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    content: {
        alignItems: 'center',
        maxWidth: 400,
        width: '100%',
    },
    iconContainer: {
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
        fontFamily: 'Lexend',
    },
    subtitle: {
        fontSize: 16,
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
        fontFamily: 'Lexend',
    },
    errorDetailsContainer: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 16,
        maxHeight: 200,
        width: '100%',
        marginBottom: 24,
    },
    errorDetailsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#EF4444',
        marginBottom: 8,
        fontFamily: 'Lexend',
    },
    errorDetailsText: {
        fontSize: 12,
        color: '#D1D5DB',
        fontFamily: 'Courier',
        lineHeight: 18,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6366F1',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 100,
        marginBottom: 16,
    },
    buttonIcon: {
        marginRight: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    helpText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        fontFamily: 'Lexend',
    },
});
