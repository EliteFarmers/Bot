'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    queryInterface.removeColumn('users', 'cheatingdata');
  },

  down: async (queryInterface, Sequelize) => {
    //Pretty pointless
    await queryInterface.addColumn('users', 'cheatingdata', {
      type: Sequelize.JSON
    });
  }
};
