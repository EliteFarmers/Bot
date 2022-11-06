'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('servers', 'lbconfig', {
			type: Sequelize.JSON,
			defaultValue: {},
		});
	},

	down: async (queryInterface, Sequelize) => {
		queryInterface.removeColumn('servers', 'lbconfig');
	},
};
