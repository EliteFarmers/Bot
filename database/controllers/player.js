const Player = require('../models').Player;

module.exports = {
    create(req, res) {
        return Player
            .create({
                uuid: req.body.uuid,
                data: req.body.data
            })
            .then(player => res.status(201).send(player))
            .catch(error => res.status(400).send(error));
    },
};