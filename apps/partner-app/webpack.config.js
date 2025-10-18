const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join } = require("path");

module.exports = {
  output: {
    path: join(__dirname, "../../dist/apps/partner-app"),
    ...(process.env.NODE_ENV !== "production" && {
      devtoolModuleFilenameTemplate: "[absolute-resource-path]",
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: "node",
      compiler: "tsc",
      main: "./src/main.ts",
      tsConfig: "./tsconfig.app.json",
      assets: [
        "./src/assets",
        "./src/views",
        "./src/public",
      ],
      optimization: false,
      outputHashing: "none",
      generatePackageJson: true,
      sourceMaps: true,
    }),
  ],
  watchOptions: {
    poll: 1000,
    ignored: /node_modules/,
  },
};
