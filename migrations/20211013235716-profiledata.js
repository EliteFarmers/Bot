'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'discordid', {
      type: Sequelize.STRING
    });
    await queryInterface.addColumn('users', 'profiledata', {
      type: Sequelize.JSON
    });
    await queryInterface.addColumn('users', 'cheatingdata', {
      type: Sequelize.JSON
    });
    await queryInterface.addColumn('users', 'styledata', {
      type: Sequelize.JSON
    });
  },

  down: async (queryInterface, Sequelize) => {
    queryInterface.removeColumn('users', 'discordid');
    queryInterface.removeColumn('users', 'profiledata');
    queryInterface.removeColumn('users', 'cheatingdata');
    queryInterface.removeColumn('users', 'styledata');
  }
};
