'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Users extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  Users.init({
    uuid: {
        type: DataTypes.STRING,
        unique: true
    },
    ign: {
        type: DataTypes.STRING
    },
    rank: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    profile: {
        type: DataTypes.STRING
    },
    weight: {
        type: DataTypes.INTEGER
    },
    discordid: {
        type: DataTypes.STRING
    },
    profiledata: {
        type: DataTypes.JSON
    },
    contestdata: {
        type: DataTypes.JSON
    },
    styledata: {
        type: DataTypes.JSON
    },
    cheating: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    updatedat: {
        type: DataTypes.STRING,
        defaultValue: Date.now().toString()
    }
}, {
    sequelize: sequelize,
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
  return Users;
};