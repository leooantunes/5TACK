import Reactotron from 'reactotron-react-native';

declare global {
  interface Console {
    tron?: typeof Reactotron;
  }
}

if (__DEV__) {
  Reactotron.configure({ name: '5TACK' })
    .useReactNative()
    .connect();

  console.tron = Reactotron;
}
