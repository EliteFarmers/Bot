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
    adminrole: DataTypes.STRING,
    channels: DataTypes.ARRAY(DataTypes.STRING),

    weightreq: DataTypes.INTEGER,
    weightrole: DataTypes.STRING,
    weightchannel: DataTypes.STRING,

    lbchannel: DataTypes.STRING,
    lbcutoff: DataTypes.STRING,
    lbrolereq: DataTypes.STRING,
    lbupdatechannel: DataTypes.STRING,
    lbroleping: DataTypes.STRING,
    
    configshowedat: DataTypes.STRING,
}, {
    sequelize: sequelize,
    tableName: 'servers',
    freezeTableName: true,
});
  return Servers;
};