'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'updatedat', {
      type: Sequelize.STRING,
      defaultValue: Date.now().toString()
    });
  },

  down: async (queryInterface, Sequelize) => {
    queryInterface.removeColumn('users', 'updatedat');
  }
};
