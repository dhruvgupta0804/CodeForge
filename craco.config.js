// craco.config.js
module.exports = {
    webpack: {
      configure: (webpackConfig) => {
        // Find the rule for source-map-loader and modify it
        webpackConfig.module.rules.forEach((rule) => {
          if (rule.use) {
            rule.use.forEach((u) => {
              if (
                typeof u === 'object' &&
                u.loader &&
                u.loader.includes('source-map-loader')
              ) {
                u.options = {
                  ...u.options,
                  filterSourceMappingUrl: (url, resourcePath) => {
                    // Exclude source maps for these modules
                    if (/node_modules[\\\/](shallowequal|engine\.io-parser|stylis)/.test(resourcePath)) {
                      return false;
                    }
                    return true;
                  },
                };
              }
            });
          }
        });
        return webpackConfig;
      },
    },
  };
  