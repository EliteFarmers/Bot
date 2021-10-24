'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'contestdata', {
      type: Sequelize.JSON
    });
  },

  down: async (queryInterface, Sequelize) => {
    queryInterface.removeColumn('users', 'contestdata');
  }
};
