module.exports = {
  name: 'lgtbot',
  script: 'src/index.ts',
  interpreter: 'bun',
  ignore_watch: ['*.db'],
  env: {
    PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
  },
};
