'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      uuid: {
          type: Sequelize.STRING,
          unique: true
      },
      ign: {
          type: Sequelize.STRING
      },
      rank: {
          type: Sequelize.INTEGER,
          defaultValue: 0
      },
      profile: {
          type: Sequelize.STRING
      },
      weight: {
          type: Sequelize.INTEGER
      },
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
  }, {
      tableName: 'users',
      freezeTableName: true,
      indexes: [
          {
              name: "weight_index",
              using: 'BTREE',
              fields: ['weight']
          }
      ]
  });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
};