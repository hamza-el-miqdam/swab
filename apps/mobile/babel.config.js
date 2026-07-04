module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last (reanimated worklet extraction).
    plugins: ['react-native-reanimated/plugin'],
  };
};
