import { router } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SignUp = () => {
  return (
    <SafeAreaView className="flex-1 justify-center items-center bg-gray-100 p-5">
      <Text className=" absolute top-10 left-10 text-center text-2xl font-bold text-gray-800 mb-5">Sign Up</Text>
      <TouchableOpacity
        onPress={() => {
          router.replace("/(auth)/sign-in");
        }}
        className="absolute top-10 right-10 bg-blue-500 py-2 px-4 rounded-full">
        <Text className="text-md font-JakartaBold text-white">Skip</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default SignUp;