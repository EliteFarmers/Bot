'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Servers extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  Servers.init({
    guildid: {
        type: DataTypes.STRING,
        unique: true
    },
    adminrole: {
        type: DataTypes.STRING,
    },
    channels: {
        type: DataTypes.ARRAY(DataTypes.STRING),
    },
    verifyreq: {
        type: DataTypes.INTEGER
    },
    verifyrole: {
        type: DataTypes.STRING
    },
    jacobchannel: {
        type: DataTypes.STRING
    },
}, {
    sequelize: sequelize,
    tableName: 'servers',
    freezeTableName: true,
});
  return Servers;
};