'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'cheating', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    
  },

  down: async (queryInterface, Sequelize) => {
    queryInterface.removeColumn('users', 'cheating');
  }
};
