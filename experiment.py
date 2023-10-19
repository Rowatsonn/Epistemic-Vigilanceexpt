"""An experiment testing epistemic vigilance as a hypothesis to explain egocentric discounting"""

import logging
from dallinger.config import get_config
from dallinger.networks import Chain
from dallinger.experiment import Experiment
from operator import attrgetter
import random
import json
import gevent
from datetime import datetime

logger = logging.getLogger(__file__)

conditions = ["Cooperative", "Fully_comp", "Hybrid"]

N = 1 # How many networks and participants do you want?

class Epivigi(Experiment):
    """Define the structure of the experiment."""

    def __init__(self, session=None):
        """Call the same function in the super (see experiments.py in dallinger).

        A few properties are then overwritten.

        Finally, setup() is called.
        """
        super(Epivigi, self).__init__(session)
        from . import models  # Import at runtime to avoid SQLAlchemy warnings

        self.models = models
        self.experiment_repeats = N # How many networks?
        self.initial_recruitment_size = N
        self.known_classes = {
            "Drone" : models.Drone,
            "Probe" : models.Probe,
            "Answer_Info" : models.Answer_Info,
            "JSON_Info" : models.JSON_Info,
            "First_guess" : models.First_guess,
            "Second_guess" : models.Second_guess,
            "Social_info" : models.Social_info,
            "Comp_Info" : models.Comp_Info,
            "Finished" : models.Finished,
        }

        if session:
            self.setup()

    def create_network(self):
        """Return a new network."""
        network = self.models.RChain(max_size = 2)
        network.condition = random.choice(conditions)
        return network

    def get_network_for_participant(self, participant):
        if participant.nodes(failed="all"):
            return None
        networks = self.networks(full=False)
        if networks:
            lowest_nodes = min([n.size() for n in networks]) # Find the lowest number of nodes
            available_networks = [n for n in networks if n.size() == lowest_nodes] # Create a list of networks with the lowest number of nodes
            return random.choice(available_networks) # Select one at random and put the participant in it
        else:
            return None 

    def create_node(self, participant, network):
        """Create a Node for the participant. Varies based on whether the network already has a player A"""
        if network.nodes():
            node = self.models.Probe(network=network, participant=participant) # Probe = Player B
        else:
            node = self.models.Drone(network=network, participant=participant) # Drone = Player A
        node.condition = node.network.condition
        return node

    def add_node_to_network(self, node, network):
        """Add node to the chain and receive transmissions."""
        network.add_node(node)
        if node.type == "Probe_node":
            Drone = network.drones[0]
            Drone.transmit(what = self.models.JSON_Info)
            node.receive()

    def bonus(self, participant):
        """This function runs when a participant completes the experiment. Here, we manually award the bonuses to player A if the player is B and let the function resolve
        as normal for player B."""
        my_node = participant.nodes()[0]
        #self.log(my_node)   
        if my_node.type == "Probe_node":
            their_node = my_node.neighbors(direction = "from")[0]
            #self.log(their_node)  
            their_participant = their_node.participant
            #self.log(their_participant)
            my_score = sum(1 for info in my_node.infos(type=self.models.Answer_Info) if info.contents == "Correct")
            their_score = sum(1 for info in their_node.infos(type=self.models.Answer_Info) if info.contents == "Correct")
            total_bonus = (my_score + their_score) * 0.10
            #self.log(total_bonus)

            if my_node.network.condition == "Cooperative" or my_score == their_score:
                my_bonus = total_bonus / 2
                their_bonus = total_bonus / 2
            elif my_node.network.condition == "Fully_comp":
                if my_score > their_score:
                    my_bonus = total_bonus
                    their_bonus = 0
                else:
                    my_bonus = 0
                    their_bonus = total_bonus
            elif my_node.network.condition == "Hybrid":
                percentage_of_bonus = total_bonus * 0.50 
                remaining_bonus = total_bonus - percentage_of_bonus
                if my_score > their_score:
                    my_bonus = percentage_of_bonus + (remaining_bonus / 2)
                    their_bonus = remaining_bonus / 2
                else:
                    my_bonus = remaining_bonus / 2
                    their_bonus = percentage_of_bonus + (remaining_bonus / 2)

            my_bonus = round(my_bonus,2)
            their_bonus = round(their_bonus,2)

            # Record the bonus amounts as a property on the nodes
            my_node.bonus = my_bonus
            their_node.bonus = their_bonus

            # bonus to them
            self.log("Bonus = {}: paying bonus".format(their_bonus))
            their_participant.recruiter.reward_bonus(
                their_participant,
                their_bonus,
                self.bonus_reason(),
                )
            return my_bonus
        else:
            return 0

    def recruit(self):
        """Recruit runs automatically when a participant finishes.
        Check if we have N nodes and no working participants. If so, recruit another block of participants (they will be Player Bs)"""

        if self.networks(full=True):
            self.recruiter.close_recruitment()
        summary = self.log_summary()
        for item in summary:
            if 'working' not in item:
                working_number = 0       

        if sum([len(n.nodes()) for n in self.networks()]) == N and working_number == 0: # Are there N nodes across the networks but no participants still working?
            self.recruiter.recruit(n=N) # Recruit another block of N participants

    def data_check(self, participant):
        """Check that the data are acceptable.

        Return a boolean value indicating whether the `participant`'s data is
        acceptable. This is meant to check for missing or invalid data. This
        check will be run once the `participant` completes the experiment. By
        default performs no checks and returns True. See also,
        :func:`~dallinger.experiments.Experiment.attention_check`.

        """
        self.log(len(participant.infos(type = self.models.Answer_Info)))
        if len(participant.infos(type = self.models.Answer_Info)) != 20: # We expect the participant to have 20 answer infos (record of correct/incorrect) if all has worked
            return False
        else:
            return True