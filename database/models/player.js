'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Player extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  Player.init({
    uuid: DataTypes.STRING,
    data: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'Player',
  });
  return Player;
};