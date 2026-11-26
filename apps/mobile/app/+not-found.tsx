import { Link, Stack } from 'expo-router';


import { ThemedText } from '@/components/Common/ThemedText';
import { ThemedView } from '@/components/Common/ThemedView';
import { styles } from '@/styles/screens/not-found.styles';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <ThemedView style={styles.container}>
        <ThemedText type="title">This screen does not exist.</ThemedText>
        <Link href="/" style={styles.link}>
          <ThemedText type="link">Go to home screen!</ThemedText>
        </Link>
      </ThemedView>
    </>
  );
}
