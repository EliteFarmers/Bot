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
    reviewchannel: DataTypes.STRING,
    reviewerrole: DataTypes.STRING,
    inreview: DataTypes.ARRAY(DataTypes.STRING),

    lbchannel: DataTypes.STRING,
    lbcutoff: DataTypes.STRING,
    lbrolereq: DataTypes.STRING,
    lbupdatechannel: DataTypes.STRING,
    lbroleping: DataTypes.STRING,
    lbactiveid: DataTypes.STRING,
	  scores: DataTypes.JSON,
    
    configshowedat: DataTypes.STRING,
}, {
    sequelize: sequelize,
    tableName: 'servers',
    freezeTableName: true,
});
  return Servers;
};