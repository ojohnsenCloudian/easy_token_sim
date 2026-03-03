import yaml
import os
import sys
import json

params = ["customer_name", "hss_status_output", "new_node_capacity", "preferred_token_number",
          "nodes_to_add", "dc_for_nodes", "region", "cumulative", "hss_ring_output", "full_log",
          "output_dir", "exclude", "stats_type"]


def parse_customer_info(yaml_file):
    stream = open(yaml_file, 'r')
    customer_info = yaml.load_all(stream, Loader=yaml.FullLoader)
    for cinfo in customer_info:
        cust = dict()
        invalid_customer_info = False
        for key, value in cinfo.items():
            # print(key + " : " + str(value))
            if key not in params:
                print(
                        "ERROR : Invalid key passed. Key = " + key + ". Will not proceed with this customer: " + str(
                    cinfo))
                invalid_customer_info = True
                break
            cust[key] = value
        if invalid_customer_info:  # Not all the required parameters passed.
            print("Invalid arguments passed. Not proceeding for the customer: " + cust["customer_name"])
            continue

        output_dir = ""
        if "output_dir" in cust.keys():
            output_dir = cust["output_dir"].strip()
            if not os.access(output_dir, os.W_OK):
                print("The specified output directory " + output_dir + " doesn't exist or not writable.")
                sys.exit(-1)
            if not output_dir.endswith("/"):
                output_dir = output_dir + "/"
        tok_file, dc_file, rack_map = parse_hsstool_ring(cust["hss_ring_output"], cust["customer_name"] + "_" + cust["region"], output_dir)
        cust["token_map"] = tok_file
        cust["dc_map"] = dc_file
        # print rack_map
        # Algorithm :
        # Call cloudian-token-simulation , initially with dryRun mode. - made changes to the simulator itself.
        # construct the parameters for node based on the total number of nodes
        # # Iterate from 1 to nodes_to_add : Form the string node_ip:tokens:DC
        # add the tokenmap and dc map parameter.
        # add custom parameter to cloudian-simulation so that (-customer customerName),
        #   it will make sure to write the information to html format after we add each node.
        # ./cloudian-token-test -node 192.168.206.8:60:S1 -dcMap us-east_dc.txt -tMap us-east_token.txt -region us-east

        current_cluster_capacity, cust["capacity_unit"], hostnames = parse_hsstool_status(cust["hss_status_output"], cust["customer_name"] + "_" + cust["region"], output_dir)
        token_count = get_total_tokens(output_dir + cust["token_map"])
        cust["current_cluster_tokens"] = str(token_count)
        cust["current_cluster_capacity"] = str(current_cluster_capacity)
        # new_node_capacity = cust["new_node_capacity"]
        # (Total Number of Tokens in Cluster / Total size of Cluster(TB)) * Size of new node(TB)
        dc_flag = False
        total_nodes_added_to_cluster = 0
        if not validate_all_dc_info_for_customer(list(cust["dc_for_nodes"]), rack_map):
            print("DC information for the customer - " + cust["customer_name"] + " is incomplete. "
                                                                                 "Please provide DCname;"
                                                                                 "Total_Number_of_Nodes_To_Add;"
                                                                                 "Node_Capacity_of_One_Node; "
                                                                                 "Policy Information (Separated by comma);"
                                                                                 "Rack_To_add in case of DC with multi RACKS[optional for single rack enviroment] ")
            continue
        print_current_expansion_info(cust, rack_map)
        new_node_pool = []
        if "nodes_to_add" in cust:
            try:
                new_node_pool = list(cust["nodes_to_add"])
                for new_node in new_node_pool:
                    if new_node.split(":")[0] in hostnames:
                        print("Warning: new node " + new_node + " has been in the cluster.")
                        sys.exit(-1)
            except:
                print("Warning: No new node hostname under nodes_to_add, use pseudo hostname.")
        for dc_policy_info in list(cust["dc_for_nodes"]):
            new_node_hostname = dict()
            # updated to split by ;
            temp_dc_policy = dc_policy_info.split(";")
            policy = ""
            rack = ""
            multi_rac = dict()
            dc = temp_dc_policy[0].strip()
            total_nodes = int(temp_dc_policy[1].strip())
            new_node_capacity = int(temp_dc_policy[2].strip())
            if len(temp_dc_policy) > 3:
                policy = temp_dc_policy[3]
            if len(temp_dc_policy) > 4 and total_nodes > 0:
                rack = temp_dc_policy[4]
                # to support adding single new racks
                rack_info = rack.split(",")
                try:
                    for sep_rack in rack_info:
                        rack_name = sep_rack.split(":")[0]
                        tot_nodes_for_rack = sep_rack.split(":")[1]
                        multi_rac[rack_name] = tot_nodes_for_rack
                except:
                    print("Error parsing rack information. Please provide the rack information "
                          "and the number of nodes to add to the rack correctly.")
                    sys.exit(-1)

            print("DC information for customer - " + cust["customer_name"] + " is validated.")
            node_info_simulation = ""
            # hack to make the division work
            current_cluster_capacity = current_cluster_capacity * 1.0
            # print("Current Cluster Capacity " + str(current_cluster_capacity))
            new_nodes_added_for_rack_analytics = []
            if len(multi_rac) >= 1:
                count_of_total_nodes_added_dc = 0
                for temp_rack_name, temp_node_count_for_rack in multi_rac.items():
                    temp_node_count_for_rack = int(temp_node_count_for_rack.strip())
                    for i in range(1, temp_node_count_for_rack + 1):
                        node_ip = str(i + total_nodes_added_to_cluster + count_of_total_nodes_added_dc) + "." + str(
                            i + total_nodes_added_to_cluster + count_of_total_nodes_added_dc) \
                                  + "." + str(i + total_nodes_added_to_cluster + count_of_total_nodes_added_dc) + "." \
                                  + str(i + total_nodes_added_to_cluster + count_of_total_nodes_added_dc)
                        # new_nodes_added_for_rack_analytics.append(node_ip + "_" + cust["region"] + "_" + dc)
                        rack_to_ep = rack_map[dc]
                        if rack_to_ep.get(temp_rack_name):
                            ep_list = rack_to_ep.get(temp_rack_name)
                            if node_ip not in ep_list:
                                ep_list.append(node_ip + "_" + cust["region"] + "_" + dc + "_" + temp_rack_name)
                        else:
                            rack_map[dc][temp_rack_name] = []
                            rack_map[dc][temp_rack_name].append(
                                node_ip + "_" + cust["region"] + "_" + dc + "_" + temp_rack_name)
                        try:
                            if isinstance(cust["preferred_token_number"], int):
                                preferred_token = cust["preferred_token_number"]
                            else:
                                preferred_token = 0
                        except KeyError:
                            preferred_token = 0
                        if preferred_token < 1:
                            token = int((token_count / current_cluster_capacity) * new_node_capacity)
                        else:
                            token = preferred_token
                        new_node_name = node_ip + "_" + cust["region"] + "_" + dc + "_" + temp_rack_name
                        node_info_simulation = node_info_simulation + new_node_name + ":" + str(token) + ":" + dc
                        new_node_hostname[new_node_name] = ""
                        for node_info in new_node_pool:
                            name_dc_rack = node_info.split(":")
                            if len(name_dc_rack) == 3 and dc == name_dc_rack[1].strip() and temp_rack_name == name_dc_rack[2].strip():
                                new_node_hostname[new_node_name] = name_dc_rack[0].strip() + ":" + temp_rack_name
                                new_node_pool.remove(node_info)
                                break
                        if new_node_hostname[new_node_name] == "":
                            new_node_hostname[new_node_name] = new_node_name + ":" + temp_rack_name
                        if int(i + count_of_total_nodes_added_dc) != total_nodes:
                            node_info_simulation = node_info_simulation + ","
                        # increase the token count and cluster capacity so that next node will get the updated information
                        token_count = token_count + token
                        current_cluster_capacity = current_cluster_capacity + new_node_capacity
                    count_of_total_nodes_added_dc = count_of_total_nodes_added_dc + temp_node_count_for_rack
            else:
                # Adding all the nodes to a single rack.
                # get the single rack name
                if rack == "":
                    rack = next(iter(rack_map[dc]))
                for i in range(1, total_nodes + 1):
                    node_ip = str(i + total_nodes_added_to_cluster) + "." + str(i + total_nodes_added_to_cluster) \
                              + "." + str(i + total_nodes_added_to_cluster) + "." + str(
                        i + total_nodes_added_to_cluster)
                    # new_nodes_added_for_rack_analytics.append(node_ip + "_" + cust["region"] + "_" + dc)
                    rack_to_ep = rack_map[dc]
                    if rack_to_ep.get(rack):
                        ep_list = rack_to_ep.get(rack)
                        if node_ip not in ep_list:
                            ep_list.append(node_ip + "_" + cust["region"] + "_" + dc)
                    else:
                        rack_map[dc][rack] = []
                        rack_map[dc][rack].append(node_ip + "_" + cust["region"] + "_" + dc)
                    try:
                        if isinstance(cust["preferred_token_number"], int):
                            preferred_token = cust["preferred_token_number"]
                        else:
                            preferred_token = 0
                    except KeyError:
                        preferred_token = 0
                    if preferred_token < 1:
                        token = int((token_count / current_cluster_capacity) * new_node_capacity)
                    else:
                        token = preferred_token
                    new_node_name = node_ip + "_" + cust["region"] + "_" + dc + "_" + rack
                    node_info_simulation = node_info_simulation + new_node_name + ":" + str(token) + ":" + dc
                    new_node_hostname[new_node_name] = ""
                    for node_info in new_node_pool:
                        name_dc_rack = node_info.split(":")
                        if len(name_dc_rack) >= 2 and dc == name_dc_rack[1].strip():
                            new_node_hostname[new_node_name] = name_dc_rack[0].strip() + ":" + rack
                            new_node_pool.remove(node_info)
                            break
                    if new_node_hostname[new_node_name] == "":
                        new_node_hostname[new_node_name] = new_node_name + ":" + rack
                    if i != total_nodes:
                        node_info_simulation = node_info_simulation + ","
                    # increase the token count and cluster capacity so that next node will get the updated information
                    token_count = token_count + token
                    current_cluster_capacity = current_cluster_capacity + new_node_capacity
            hostname_file = write_to_hostname_file(cust["customer_name"] + "_" + cust["region"], new_node_hostname, output_dir, "a+")
            param_for_simulation = "./cloudian-token-test "
            if "full_log" in cust.keys() and cust["full_log"].lower() == "true":
                param_for_simulation = param_for_simulation + "-fullLog "
            if "exclude" in cust.keys():
                param_for_simulation = param_for_simulation + "-exclude \"" + cust["exclude"].replace(" ", "") + "\" "
            if "stats_type" in cust.keys():
                param_for_simulation = param_for_simulation + "-statsType " + cust["stats_type"] + " "
            if output_dir != "":
                param_for_simulation = param_for_simulation + "-dir " + output_dir + " "
            if total_nodes > 0:
                # if we are simulating adding with multiple dc for the same customer, then we need to
                # update our token and dc map with the information from the newly added DC also.
                if dc_flag:
                    cust["dc_map"] = cust["customer_name"] + "_" + cust["region"] + "_dc.txt"
                    cust["token_map"] = cust["customer_name"] + "_" + cust["region"] + "_token.txt"
                dc_flag = True
                param_for_simulation = param_for_simulation + "-node " + node_info_simulation
                is_cumm = cust["cumulative"].lower()
                if is_cumm == "true":
                    param_for_simulation = param_for_simulation + " -cumulativeTokens"
            else:
                param_for_simulation = param_for_simulation + "-dryRunDC " + dc
            param_for_simulation = param_for_simulation + " -tMap " + cust["token_map"] + " -dcMap " + cust[
                "dc_map"] + " -hostMap " + hostname_file + " -customer " + cust["customer_name"] + " -region " + cust["region"]

            total_nodes_added_to_cluster = total_nodes_added_to_cluster + total_nodes

            if policy != "":
                param_for_simulation = param_for_simulation + " -policy " + policy

            if len(rack_map[dc]) > 1:
                param_for_simulation = param_for_simulation + " -rack " + get_rack_info_for_dc(dc, rack_map)
            # make simulator call.
            if total_nodes > 0:
                print("Making call to run the simulation " + param_for_simulation)
            else:
                print("Making call to dry run " + param_for_simulation)

            os.system(param_for_simulation)


def print_current_expansion_info(cluster_info, dc_info):
    print(" ************************************** Start Customer Cluster Expansion Information ************************************** \n")
    print("Customer Name - " + cluster_info["customer_name"] + "\n")
    print("Customer Region - " + cluster_info["region"] + "\n")
    print("Hsstool Ring path - " + cluster_info["hss_ring_output"] + "\n")
    print("Hsstool Status path - " + cluster_info["hss_status_output"] + "\n")
    print("Current cluster capacity - " + cluster_info["current_cluster_capacity"] + " " + cluster_info["capacity_unit"] + "\n")
    print("Current cluster tokens - " + cluster_info["current_cluster_tokens"] + "\n")
    print("Customer (" + cluster_info["customer_name"] + ") has totally " + str(len(dc_info.keys())) + " DC(s). \n")
    print("Adding nodes to " + str(len(cluster_info["dc_for_nodes"])) + " DC(s) in this cluster expansion. \n")
    if "output_dir" in cluster_info and len(cluster_info["output_dir"]) > 0:
        print("Output directory for tokens and json type statistic is \"" + cluster_info["output_dir"] + "\". \n")
    else:
        print("Output directory for tokens and json type statistic is current directory. \n")
    if "exclude" in cluster_info and len(cluster_info["exclude"]) > 0:
        print("Excluding nodes " + cluster_info["exclude"] + " when calculating balance in this expansion. \n")
    if "stats_type" in cluster_info and len(cluster_info["stats_type"]) > 0:
        print("Statistics type is \"" + cluster_info["stats_type"] + "\". \n")
    else:
        print("Statistics type is \"plain-text\". \n")
    for dc_policy_info in cluster_info["dc_for_nodes"]:
        dc_info = dc_policy_info.split(";")
        print("DC Name - " + dc_info[0] + "\n")
        if int(dc_info[1]) == 0:
            print("\t\tDry run mode.\n")
        else:
            try:
                if isinstance(cluster_info["preferred_token_number"], int):
                    token = cluster_info["preferred_token_number"]
                else:
                    token = 0
            except KeyError:
                token = 0
            if token > 0:
                print("\t\tAdding totally " + str(dc_info[1]) + " nodes with each " + str(token) + " tokens.\n")
            else:
                print("\t\tAdding totally " + str(dc_info[1]) + " nodes with each " + str(dc_info[2]) + " " +
                          cluster_info["capacity_unit"] + ".\n")

        if len(dc_info) == 5 and int(dc_info[1]) != 0:
            rack_info = dc_info[4]
            racks = rack_info.split(",")
            for rac in racks:
                temp_rac = rac.split(":")
                print("\t\tAdding " + temp_rac[1] + " nodes to rack " + temp_rac[0] + "\n")
        print("\t\tStorage Policies \n")
        storage_policy_list = dc_info[3].split(",")
        for storage_policy in storage_policy_list:
            policy = storage_policy.split(":")
            if len(policy) == 2:
                temp_policy = policy[0].split("+")
                if len(temp_policy) == 2:
                    k = int(temp_policy[0].strip())
                    m = int(temp_policy[1].strip())
                    total_fragments = k+m
                    ec_rf = policy[1].split("_")
                    ec = int(ec_rf[0].strip())
                    rf = 0
                    if len(ec_rf) == 2:
                        rf = int(ec_rf[1].strip())
                        if rf < 1 or rf > total_fragments:
                            print("RF of Hybrid policy count out of range [1, k+m]")
                            sys.exit(-1)
                    print("\t\t\t\t", end=' ')
                    if (rf > 0):
                        print("Hybrid", end=' ')
                    if total_fragments == ec:
                        print("EC " + policy[0] + " storing all fragments in this DC.", end=' ')
                        if (rf > 0):
                            print ("And storing " + str(rf) + " replica(s) in this DC.\n")
                        else:
                            print ("\n")
                    else:
                        print("EC " + policy[0] + " storing " + str(ec) + " fragments in this DC.", end=' ')
                        if (rf > 0):
                            print ("And storing " + str(rf) + " replica(s) in this DC.\n")
                        else:
                            print ("\n")
                else:
                    print("\t\t\t\tRF " + policy[0] + " storing " + policy[1] + " replicas in this DC.\n")
            else:
                temp_policy = policy[0].split("+")
                if len(temp_policy) == 2:
                    print("\t\t\t\tEC " + policy[0] + " storing all fragments in this DC.\n")
                else:
                    print("\t\t\t\tRF " + policy[0] + " storing all replicas in this DC.\n")
    print(
        " ************************************** End Customer Cluster Expansion Information ************************************** \n")

    print("Please confirm if you want to continue with the Simulation.\n")
    confirm = int(input("Press 1 to continue, Press 0 to exit\n"))

    if confirm == 1:
        print("Continuing with the simulation.\n")
    else:
        print("Terminating the simulation process. Please run the simulator again with valid configurations.\n")
        sys.exit(-1)


def parse_customer_info_interactive():
    cust = dict()
    while True:
        try:
            cust["customer_name"] = input("Please enter the customer name: \n")
        except ValueError:
            print("Sorry, I didn't understand that.")
            continue
        else:
            break
    print("")
    while True:
        try:
            cust["region"] = input("Please enter the customer region: \n")
        except ValueError:
            print("Sorry, I didn't understand that.")
            continue
        else:
            break
    hsstool_ring_msg = "Please enter the complete hsstool ring file path for the customer " + cust[
        "customer_name"] + " \n"
    print("")
    while True:
        try:
            cust["hss_ring_output"] = input(hsstool_ring_msg)
            if not os.path.isfile(cust["hss_ring_output"]):
                hsstool_ring_msg = cust["hss_ring_output"] + " file does not exist. Please enter the correct path.\n"
                continue
        except ValueError:
            print("Sorry, I didn't understand that.")
            continue
        else:
            break
    print("")
    hsstool_status_msg = "Please enter the hsstool status file path for the customer " + cust["customer_name"] + "\n"
    while True:
        try:
            cust["hss_status_output"] = input(hsstool_status_msg)
            if not os.path.isfile(cust["hss_status_output"]):
                hsstool_status_msg = cust["hss_status_output"] + " file does not exist. Please enter the correct path."
                continue
        except ValueError:
            print("Sorry, I didn't understand that.")
            continue
        else:
            break
    print("")
    cumulative = "true"
    while True:
        try:
            cumul = input("Add token cumulatively (y/n): y\n")
            if cumul == "n":
                cumulative = "false"
            elif cumul != "y" and cumul != "n" and cumul != "":
                print("Invalid input")
                continue
        except ValueError:
            print("Sorry, I didn't understand that.")
            continue
        else:
            break
    tok_file, dc_file, rack_map = parse_hsstool_ring(cust["hss_ring_output"], cust["customer_name"] + "_" + cust["region"], "")
    cust["token_map"] = tok_file
    cust["dc_map"] = dc_file
    # print rack_map
    # Algorithm :
    # Call cloudian-token-simulation , initially with dryRun mode. - made changes to the simulator itself.
    # construct the parameters for node based on the total number of nodes
    # # Iterate from 1 to nodes_to_add : Form the string node_ip:tokens:DC
    # add the tokenmap and dc map parameter.
    # add custom parameter to cloudian-simulation so that (-customer customerName),
    #   it will make sure to write the information to html format after we add each node.
    # ./cloudian-token-test -node 192.168.206.8:60:S1 -dcMap us-east_dc.txt -tMap us-east_token.txt -region us-east

    current_cluster_capacity, cust["capacity_unit"], hostnames = parse_hsstool_status(cust["hss_status_output"], cust["customer_name"] + "_" + cust["region"], "./")
    token_count = get_total_tokens("./" + cust["token_map"])
    # print("Current token count " + str(token_count))
    cust["current_cluster_tokens"] = str(token_count)
    cust["current_cluster_capacity"] = str(current_cluster_capacity)
    # new_node_capacity = cust["new_node_capacity"]
    # (Total Number of Tokens in Cluster / Total size of Cluster(TB)) * Size of new node(TB)
    dc_flag = False
    total_nodes_added_to_cluster = 0
    dc_name_msg = "Please enter the DC name.\n"
    num_of_nodes_to_add_msg = "Please enter the total number of nodes to add.\n"
    capacity_node_msg = "Please enter the capacity of the new node to add in " + cust["capacity_unit"] + "\n"
    cust["dc_for_nodes"] = []
    rack_info = ""
    dc_num = 0
    policy_num = 1
    dry_run = True

    while True:
        try:
            print("")
            print("Available DCs : ")
            for DC in rack_map:
                print(DC)
            print("")
            dc_name = input(dc_name_msg)
            while not rack_map.get(dc_name):
                dc_name = input("DC name (" + dc_name + ") entered does not exist, please enter the correct DC name \n")
            print("")
            num_of_nodes_to_add = int(input(num_of_nodes_to_add_msg))
            capacity_node = 0
            if num_of_nodes_to_add != 0:
                print("")
                capacity_node = int(input(capacity_node_msg))
                dry_run = False
            else:
                print("Dry run mode.")
            storage_policies = ""
            print("")
            print("Add storage policies. \n")

            while True:
                print("")
                print("Adding Storage policy #" + str(policy_num))
                print("For RF Storage policy, Press 0")
                print("For EC Storage policy, Press 1")
                print("To finish adding storage policy for this DC, Press 2")
                policy_num = policy_num + 1
                ec_or_rf = int(input())
                if ec_or_rf == 0:
                    rf = int(input("Enter the Replication Factor value for this RF policy. \n"))
                    if len(rack_map.keys()) > 1:
                        replica = int(input("Enter the number of replicas stored in this DC. If all replicas are stored in this DC. Enter 0.\n"))
                    else:
                        replica = 0

                    if replica != 0:
                        if storage_policies == "":
                            storage_policies = str(rf) + ":" + str(replica)
                        else:
                            storage_policies = storage_policies + "," + str(rf) + ":" + str(replica)
                    else:
                        if storage_policies == "":
                            storage_policies = str(rf)
                        else:
                            storage_policies = storage_policies + "," + str(rf)
                elif ec_or_rf == 1:
                    ec_policy = input("Enter the k+m value. For example, if its a EC 4+2 policy, then enter 4+2 \n")
                    if len(rack_map.keys()) > 1:
                        replica = int(input("Enter the number of fragments stored in this DC. If all fragments are stored in this DC. Enter 0.\n"))
                    else:
                        replica = 0
                    if replica != 0:
                        if storage_policies == "":
                            storage_policies = str(ec_policy) + ":" + str(replica)
                        else:
                            storage_policies = storage_policies + "," + str(ec_policy) + ":" + str(replica)
                    else:
                        ec_policy_num = ec_policy.split("+")
                        k_m_val = int(ec_policy_num[0]) + int(ec_policy_num[1])
                        if storage_policies == "":
                            storage_policies = str(ec_policy) + ":" + str(k_m_val)
                        else:
                            storage_policies = storage_policies + "," + str(ec_policy) + ":" + str(k_m_val)
                elif ec_or_rf == 2:
                    # to check whether the customer is having multi rack configuration or not
                    if len(rack_map.get(dc_name).keys()) > 1:
                        tot_nodes_for_this_rack = 0
                        while tot_nodes_for_this_rack != num_of_nodes_to_add:
                            rack_info = ""
                            tot_nodes_for_this_rack = 0
                            print("")
                            for rack_name in rack_map.get(dc_name).keys():
                                rack_num = int(
                                    input("Please enter the number of nodes to add to rack - " + rack_name + "\n"))
                                tot_nodes_for_this_rack = tot_nodes_for_this_rack + rack_num
                                if rack_info == "":
                                    rack_info = rack_name + ":" + str(rack_num)
                                else:
                                    rack_info = rack_info + "," + rack_name + ":" + str(rack_num)
                            while tot_nodes_for_this_rack < num_of_nodes_to_add:
                                rack_name = input("Please enter the new rack name to add the node - \n")
                                rack_num = int(
                                    input("Please enter the number of nodes to add to rack - " + rack_name + "\n"))
                                tot_nodes_for_this_rack = tot_nodes_for_this_rack + rack_num
                                if rack_info == "":
                                    rack_info = rack_name + ":" + str(rack_num)
                                else:
                                    rack_info = rack_info + "," + rack_name + ":" + str(rack_num)

                                if tot_nodes_for_this_rack != num_of_nodes_to_add:
                                    print("Total number of nodes initially requested was " + str(num_of_nodes_to_add) +
                                          ", but  you have added " + str(tot_nodes_for_this_rack) +
                                          " nodes to all the rack. Please run the tool again.")
                                    exit(-1)

                    if rack_info == "":
                        cust["dc_for_nodes"].append(dc_name + ";" + str(num_of_nodes_to_add) + ";" + str(
                            capacity_node) + ";" + storage_policies)
                    else:
                        cust["dc_for_nodes"].append(dc_name + ";" + str(num_of_nodes_to_add) + ";" + str(
                            capacity_node) + ";" + storage_policies + ";" + rack_info)
                    break
                else:
                    print("Invalid Input. Please re-enter the choice again.\n")
            dc_num = dc_num + 1
            if dc_num < len(rack_map.keys()):
                to_continue = int(input("To add information for another DC, press 1 else press 2 \n"))
                if to_continue != 1:
                    break
                else:
                    print("")
            else:
                break
        except ValueError:
            print("Sorry, I didn't understand that.")
            # better try again... Return to the start of the loop
            continue

    preferred_token_number = 0
    if dry_run is False:
        print("")
        while True:
            try:
                token_number_input = input("Please enter the preferred token number for each new node."
                                           " Or press return to use the default: \n")
                if token_number_input == "":
                    break
                elif int(token_number_input) > 0:
                    preferred_token_number = int(token_number_input)
                else:
                    print("The number should not be less than 1.")
                    continue
            except (ValueError, TypeError):
                print("Sorry, I didn't understand that.")
                continue
            else:
                break
    cust["preferred_token_number"] = preferred_token_number

    if not validate_all_dc_info_for_customer(list(cust["dc_for_nodes"]), rack_map):
        print("DC information for the customer - " + cust["customer_name"] + " is incomplete. "
                                                                             "Please provide DCname;"
                                                                             "Total_Number_of_Nodes_To_Add;"
                                                                             "Node_Capacity_of_One_Node; "
                                                                             "Policy Information (Separated by comma);"
                                                                             "Rack_To_add in case of DC with multi RACKS[optional for single rack enviroment] ")
        exit(-1)
    print_current_expansion_info(cust, rack_map)
    for dc_policy_info in list(cust["dc_for_nodes"]):
        new_node_hostname = dict()
        # updated to split by ;
        temp_dc_policy = dc_policy_info.split(";")
        policy = ""
        rack = ""
        multi_rac = dict()
        dc = temp_dc_policy[0].strip()
        total_nodes = int(temp_dc_policy[1].strip())
        new_node_capacity = int(temp_dc_policy[2].strip())
        if len(temp_dc_policy) > 3:
            policy = temp_dc_policy[3]
        if len(temp_dc_policy) > 4:
            rack = temp_dc_policy[4]
            if "," in rack:
                rack_info = rack.split(",")
                try:
                    for sep_rack in rack_info:
                        rack_name = sep_rack.split(":")[0]
                        tot_nodes_for_rack = sep_rack.split(":")[1]
                        multi_rac[rack_name] = tot_nodes_for_rack
                except:
                    print("Error parsing rack information. Please provide the rack information "
                          "and the number of nodes to add to the rack correctly.")
                    sys.exit(-1)

        print("DC information for customer - " + cust["customer_name"] + " is validated.")
        node_info_simulation = ""
        # hack to make the division work
        current_cluster_capacity = current_cluster_capacity * 1.0
        # print("Current Cluster Capacity " + str(current_cluster_capacity))
        new_nodes_added_for_rack_analytics = []

        if len(multi_rac) >= 1:
            count_of_total_nodes_added_dc = 0
            for temp_rack_name, temp_node_count_for_rack in multi_rac.items():
                temp_node_count_for_rack = int(temp_node_count_for_rack.strip())
                for i in range(1, temp_node_count_for_rack + 1):
                    node_ip = str(i + total_nodes_added_to_cluster + count_of_total_nodes_added_dc) + "." + str(
                        i + total_nodes_added_to_cluster + count_of_total_nodes_added_dc) \
                              + "." + str(i + total_nodes_added_to_cluster + count_of_total_nodes_added_dc) + "." \
                              + str(i + total_nodes_added_to_cluster + count_of_total_nodes_added_dc)
                    # new_nodes_added_for_rack_analytics.append(node_ip + "_" + cust["region"] + "_" + dc)
                    rack_to_ep = rack_map[dc]
                    if rack_to_ep.get(temp_rack_name):
                        ep_list = rack_to_ep.get(temp_rack_name)
                        if node_ip not in ep_list:
                            ep_list.append(node_ip + "_" + cust["region"] + "_" + dc + "_" + temp_rack_name)
                    else:
                        rack_map[dc][temp_rack_name] = []
                        rack_map[dc][temp_rack_name].append(
                            node_ip + "_" + cust["region"] + "_" + dc + "_" + temp_rack_name)
                    if preferred_token_number > 0:
                        token = preferred_token_number
                    else:
                        token = int((token_count / current_cluster_capacity) * new_node_capacity)
                    new_node_name = node_ip + "_" + cust["region"] + "_" + dc + "_" + temp_rack_name
                    node_info_simulation = node_info_simulation + new_node_name + ":" + str(token) + ":" + dc
                    new_node_hostname[new_node_name] = new_node_name + ":" + temp_rack_name
                    if int(i + count_of_total_nodes_added_dc) != total_nodes:
                        node_info_simulation = node_info_simulation + ","
                    # increase the token count and cluster capacity so that next node will get the updated information
                    token_count = token_count + token
                    current_cluster_capacity = current_cluster_capacity + new_node_capacity
                count_of_total_nodes_added_dc = count_of_total_nodes_added_dc + temp_node_count_for_rack
        else:
            # Adding all the nodes to a single rack.
            # get the single rack name
            if rack == "":
                rack = next(iter(rack_map[dc]))
            for i in range(1, total_nodes + 1):
                node_ip = str(i + total_nodes_added_to_cluster) + "." + str(i + total_nodes_added_to_cluster) \
                          + "." + str(i + total_nodes_added_to_cluster) + "." + str(
                    i + total_nodes_added_to_cluster)
                # new_nodes_added_for_rack_analytics.append(node_ip + "_" + cust["region"] + "_" + dc)
                rack_to_ep = rack_map[dc]
                if rack_to_ep.get(rack):
                    ep_list = rack_to_ep.get(rack)
                    if node_ip not in ep_list:
                        ep_list.append(node_ip + "_" + cust["region"] + "_" + dc)
                else:
                    rack_map[dc][rack] = []
                    rack_map[dc][rack].append(node_ip + "_" + cust["region"] + "_" + dc)
                if cust["preferred_token_number"] > 0:
                    token = cust["preferred_token_number"]
                else:
                    token = int((token_count / current_cluster_capacity) * new_node_capacity)
                new_node_name = node_ip + "_" + cust["region"] + "_" + dc + "_" + rack
                node_info_simulation = node_info_simulation + new_node_name + ":" + str(token) + ":" + dc
                new_node_hostname[new_node_name] = new_node_name + ":" + rack
                if i != total_nodes:
                    node_info_simulation = node_info_simulation + ","
                # increase the token count and cluster capacity so that next node will get the updated information
                token_count = token_count + token
                current_cluster_capacity = current_cluster_capacity + new_node_capacity
        hostname_file = write_to_hostname_file(cust["customer_name"]  + "_" + cust["region"], new_node_hostname, "./", "a+")
        param_for_simulation = "./cloudian-token-test "
        dryRun = False
        if len(node_info_simulation) == 0:
            param_for_simulation = param_for_simulation + "-dryRunDC " + dc
            dryRun = True
        else:
            # if we are simulating adding with multiple dc for the same customer, then we need to
            # update our token and dc map with the information from the newly added DC also.
            param_for_simulation = param_for_simulation + "-hostMap " + hostname_file + " "
            if dc_flag:
                cust["dc_map"] = cust["customer_name"] + "_" + cust["region"] + "_dc.txt"
                cust["token_map"] = cust["customer_name"] + "_" + cust["region"] + "_token.txt"
            dc_flag = True
            param_for_simulation = param_for_simulation + "-node " + node_info_simulation
            if cumulative == "true":
                param_for_simulation = param_for_simulation + " -cumulativeTokens"

        param_for_simulation = param_for_simulation + " -tMap " + cust["token_map"] + " -dcMap " + cust["dc_map"] \
                               + " -customer " + cust["customer_name"] + " -region " + cust["region"]
        total_nodes_added_to_cluster = total_nodes_added_to_cluster + total_nodes
        if policy != "":
            param_for_simulation = param_for_simulation + " -policy " + policy

        if len(rack_map[dc]) > 1:
            param_for_simulation = param_for_simulation + " -rack " + get_rack_info_for_dc(dc, rack_map)
        # make simulator call.
        if dryRun:
            print("Making call to dry run " + param_for_simulation)
        else:
            print("Making call to run the simulation " + param_for_simulation)

        os.system(param_for_simulation)


def get_rack_info_for_dc(dc, rack_map):
    rac_info = ""
    i = 0

    for key, value in rack_map.get(dc).items():
        rack_name = key
        if i == 0:
            rac_info = rac_info + rack_name + ":"
        else:
            rac_info = rac_info + "#" + rack_name + ":"
        i = i + 1
        j = 0
        for ep in value:
            if j == 0:
                # if rack_name.lower() == rack.lower():
                #     new_ep = ''
                #     k = 0
                #     # add the new nodes also to the rack
                #     for new_node in new_nodes:
                #         if k == 0:
                #             new_ep = new_node
                #         else:
                #             new_ep = new_ep + "," + new_node
                #         k = k + 1
                #     rac_info = rac_info + new_ep + "," + ep
                # else:
                rac_info = rac_info + ep

            else:
                rac_info = rac_info + "," + ep
            j = j + 1
    return rac_info


def get_total_tokens(token_map_path):
    file = open(token_map_path, mode='r')

    # read all lines at once
    all_of_it = file.read()
    count = all_of_it.count("=")
    # close the file
    file.close()
    # print("Total tokens from token map : " + str(count))
    return count


def write_to_dc_file(customer_info, dc_map, output_dir):
    dc_file_name = customer_info + "_dc.txt"
    dc_file = open(output_dir + dc_file_name, "w+")
    for key in dc_map:
        dc_file.write(key + "=")
        lis = dc_map[key]
        for i in range(0, len(lis)):
            if i == len(lis) - 1:
                dc_file.write(lis[i])
            else:
                dc_file.write(lis[i] + ",")
        dc_file.write("\n")
    dc_file.close()
    return dc_file_name

def write_to_hostname_file(customer_info, host_map, output_dir, method):
    hostname_file_name = customer_info + "_hostname.txt"
    hostname_file = open(output_dir + hostname_file_name, method)
    for key in host_map:
        hostname_file.write(key + "=" + host_map[key] + "\n")
    hostname_file.close()
    return hostname_file_name

def parse_hsstool_ring(file_path, customer_info, output_dir):
    file = open(file_path, mode='r')
    token_file = customer_info + "_tokenmap.txt"
    token_map = open(output_dir + token_file, "w+")
    dc_map = dict()
    rack_map = dict()
    # read all lines at once
    line = file.readline()
    while line:
        if not line[0].isdigit():
            line = file.readline()
            continue
        # 172.16.249.113    DC-ZF   R1  Up  44.27 GB    Up  Normal  175077759698721219099512673100890112
        node_info = line.split("\t")
        # if dc_map[node_info[1]]:
        #     dc_map[node_info[1]] = dc_map[node_info[1]] + node_info[0]
        # else:
        #     dc_map[node_info[1]] = dc_map[node_info[1]] + node_info[0]

        if dc_map.get(node_info[1]):
            lis = dc_map[node_info[1]]
            if node_info[0] not in lis:
                dc_map[node_info[1]].append(node_info[0])
        else:
            dc_map[node_info[1]] = []
            dc_map[node_info[1]].append(node_info[0])

        if rack_map.get(node_info[1]):
            rack_to_ep = rack_map[node_info[1]]
            if rack_to_ep.get(node_info[2]):
                ep_list = rack_to_ep.get(node_info[2])
                if node_info[0] not in ep_list:
                    ep_list.append(node_info[0])
            else:
                rack_to_ep[node_info[2]] = []
                rack_to_ep[node_info[2]].append(node_info[0])
        else:
            rack_map[node_info[1]] = dict()
            rack_map[node_info[1]][node_info[2]] = []
            rack_map[node_info[1]][node_info[2]].append(node_info[0])

        line = file.readline()
        if line:
            token_map.write(node_info[len(node_info) - 1].strip() + "=" + node_info[0].strip() + ",\n")
        else:
            token_map.write(node_info[len(node_info) - 1].strip() + "=" + node_info[0].strip())

    # print(dc_map)
    dc_file = write_to_dc_file(customer_info, dc_map, output_dir)
    token_map.close()
    return token_file, dc_file, rack_map


def parse_hsstool_status(file_path_hsstool_status, customer_info, output_dir):
    file = open(file_path_hsstool_status, mode='r')
    line = file.readline()
    total_size = 0.0
    capacity_unit = "TB"
    #hostname_file_name = customer_info + "_hostname.txt"
    #hostname_file = open(output_dir + hostname_file_name, "w+")
    host_map = dict()
    hostnames = []
    while line:
        current_size = 0
        if not line[0].isdigit():
            line = file.readline()
            continue
        current_size = line.split("/")[1].strip().split(" ")[0]
        unit = line.split("/")[1].strip().split(" ")[1]
        if unit == "GB" and capacity_unit == "TB":
            capacity_unit = "GB"
        total_size = total_size + float(current_size)
        # ip to hostname mapping
        node_info = line.split("\t")
        hostname = node_info[len(node_info) - 1].strip()
        host_map[node_info[0].strip()] = hostname + ":" + node_info[2].strip()
        hostnames.append(hostname)
        #hostname_file.write(node_info[0].strip() + "=" + node_info[len(node_info) - 1].strip() + ":" + node_info[2].strip() + "\n")
        line = file.readline()
    file.close()
    #hostname_file.close()
    write_to_hostname_file(customer_info, host_map, output_dir, "w+")
    return int(total_size), capacity_unit, hostnames


def validate_all_dc_info_for_customer(dc_info_list, rack_map):
    for dc_policy_info in dc_info_list:
        dc_policy = dc_policy_info.split(";")
        if len(dc_policy) < 4 or len(dc_policy) > 5:
            return False
        current_dc = dc_policy[0].strip()

        if current_dc not in rack_map:
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!! NOTE: You are adding new DC - " + current_dc + ". Please double check if the DC name is a typo  !!!!!!!!!!!!!!!!!!!!!!!!!!!")
            while True:
                try:
                    confirm = input("Continue: (y/n) \n")
                    if confirm == "y" or confirm == "Y":
                        break
                    else:
                        return False
                except ValueError:
                    print("Sorry, I didn't understand that.")
                    continue
            print("")

            if (len(dc_policy) < 5):
                print(
                    "!!!!!!!!!!!!!!!!!!!!!!!!!!! ERROR : DC - " + current_dc + " is a new DC. Please provide the rack information to customer_info.yaml file !!!!!!!!!!!!!!!!!!!!!!!!!!!")
                return False
            else:
                racks = dc_policy[4].strip().split(",")
                if (len(racks) < 1):
                    print(
                        "!!!!!!!!!!!!!!!!!!!!!!!!!!! ERROR : DC - " + current_dc + " is a new DC. Please provide the rack information to customer_info.yaml file !!!!!!!!!!!!!!!!!!!!!!!!!!!")
                    return False

            total_ep = int(dc_policy[1])
            if total_ep == 0:
                print(
                    "!!!!!!!!!!!!!!!!!!!!!!!!!!! ERROR : DC - " + current_dc + " is a new DC. Dry run mode is not supported !!!!!!!!!!!!!!!!!!!!!!!!!!!")
                return False
            new_dc_rack_map = {}
            for rac in racks:
                parts = rac.split(":")
                if len(parts) == 2:
                    total_ep = total_ep - int(parts[1])
                    rac_name = parts[0]
                    new_dc_rack_map[rac_name] = []
                else:
                    print(f"Invalid format for rack: {rac}")

            if total_ep != 0:
                print(
                    "!!!!!!!!!!!!!!!!!!!!!!!!!!! ERROR : DC - " + current_dc + ", total new node number doesn't match the sum of nodes number in each Rack !!!!!!!!!!!!!!!!!!!!!!!!!!!")
                return False
            rack_map[current_dc] = new_dc_rack_map
            continue

        if len(rack_map.get(current_dc)) > 1 and len(dc_policy) == 4 and int(dc_policy[1].strip()) != 0:
            print(
                    "!!!!!!!!!!!!!!!!!!!!!!!!!!! ERROR : DC - " + current_dc + " seems to have multi rack configuration. Please provide the rack information to customer_info.yaml file !!!!!!!!!!!!!!!!!!!!!!!!!!!")
            return False
        elif len(dc_policy) == 5:
            rack_provided = dc_policy[4].strip()
            if len(rack_provided) == 0:
                print(
                        "!!!!!!!!!!!!!!!!!!!!!!!!!!! ERROR : DC - " + current_dc + " seems to have multi rack configuration. Please provide the rack information to customer_info.yaml file !!!!!!!!!!!!!!!!!!!!!!!!!!!")
                return False
            all_racks = rack_provided.split(",")
            for rac in all_racks:
                rac_name = rac.split(":")[0]
                # only when the customer is having a single reck currently, we will not allow them to add new racks.
                if not rack_map.get(current_dc).get(rac_name) and len(rack_map.get(current_dc)) == 1:
                    print(
                            "!!!!!!!!!!!!!!!!!!!!!!!!!!! ERROR : DC - " + current_dc + " does not seem to have multi rack configuration so we cannot add a new Rack to this DC. Please update the yaml file !!!!!!!!!!!!!!!!!!!!!!!!!!!")
                    return False
    return True


def parse_token_log(yaml_file, token_log):
    """
    cum new - grep Min divide by dcs
    cum old - grep Min divide by dcs
    non cum new - grep Min divide by dcs
    non cum old - grep Min divide by dcs
    :param token_log:
    :return:
    """
    with(open(token_log)) as log_f:
        log_f = log_f.readlines()

    # match = []
    # for line in range(len(log_f)):
    #     if 'printNodeToTokenOwnerShip' in log_f[line]:
    #         match.append(line)

    # for each_line in log_f[match[-1]+1:]:
    #     if 'Min' in each_line:
    #         print(each_line)

    customer_info = []
    with open(yaml_file) as file:
        customer_yaml = yaml.load_all(file, Loader=yaml.FullLoader)

        for customer in customer_yaml:
            customer_info.append(customer)
    print(customer_info)
    """
    [{'customer_name': 'arup-labs-20180522=campus', 'hss_ring_output': 'ool-ring_out.txt', 'hss_status_output': 'status_out.txt', 
    'dc_for_nodes': ['Chipeta: 40: 108: 12', 'dc2: 12: 457: 12', 'DR: 16: 314: 12'], 'region': 'campus', 'cumulative': 'False'}]
    """
    new_customer_info = {}

    dc_count = 0
    if len(customer_info) == 1:
        new_customer_info['customer_name'] = customer_info[0]['customer_name']
        new_customer_info['region'] = customer_info[0]['region']
        new_customer_info['cumulative'] = customer_info[0]['cumulative']
        new_customer_info['dc_for_nodes'] = []
        dc_info = customer_info[0]['dc_for_nodes']
        dc_count = len(dc_info)
        for each_dc in dc_info:
            parsed_dc_info = {}
            split_dc_info = each_dc.split(":")
            parsed_dc_info['dc_name'] = split_dc_info[0]
            parsed_dc_info['add_node_count'] = split_dc_info[1].strip()
            parsed_dc_info['new_node_capacity'] = split_dc_info[2].strip()
            parsed_dc_info['policy_info'] = []
            policies = split_dc_info[3].strip().split(",")
            for each_policy in policies:
                policy = {'rep_factor': each_policy}
                parsed_dc_info['policy_info'].append(policy)
            new_customer_info['dc_for_nodes'].append(parsed_dc_info)
            # print("~~~~~", parsed_dc_info)

        # get all the Min matching lines
        rep_percent = []
        for each_line in log_f:
            if 'Min' in each_line:
                rep_percent.append(each_line)
        # print("rep_percent------",rep_percent)
        print()
        # split the Min matching lines to dc count no of sub lists
        per_dc_rep_percent = []
        step = len(rep_percent) // dc_count
        for i in range(dc_count):
            if i == 0:
                # print("if--",i, step)
                # print(rep_percent[i:step])
                per_dc_rep_percent.append(rep_percent[i:step])
            else:
                i = step
                step = len(rep_percent) // dc_count
                step = i + step
                # print("else--", i, step)
                # print(rep_percent[i:step])
                per_dc_rep_percent.append(rep_percent[i:step])
        # print("per_dc_rep_percent-----", per_dc_rep_percent)

        # get the required stats based on no of policies
        extract_policy_rep_percent = []
        for dc in range(len(per_dc_rep_percent)):
            policies_count = len(new_customer_info['dc_for_nodes'][dc]['policy_info'])
            extract_policy_rep_percent.append(per_dc_rep_percent[dc][-policies_count:])
            rep_percent_log_list = per_dc_rep_percent[dc][-policies_count:]

            for i in range(len(new_customer_info['dc_for_nodes'][dc]['policy_info'])):
                new_customer_info['dc_for_nodes'][dc]['policy_info'][i]['rep_per'] = rep_percent_log_list[i][
                                                                                     rep_percent_log_list[i].find(
                                                                                         "Min"):]
        # print("\n\nextract_policy_rep_percent-----", policies_count, extract_policy_rep_percent)

    # pprint.pprint(new_customer_info)
    print(json.dumps(new_customer_info, indent=4))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("For Interactive version Run: python simulate_add_node.py -i")
        print("For using YAML file as input, Run: python simulate_add_node.py <path_to_YAML_file>. Ex: python simulate_add_node.py conf/customer_info.yaml")
        sys.exit(0)
    yaml_file = sys.argv[1]
    if yaml_file == "-h":
        print("For Interactive version Run: python simulate_add_node.py -i")
        print("For using YAML file as input, Run: python simulate_add_node.py <path_to_YAML_file>. Ex: python simulate_add_node.py conf/customer_info.yaml")
        sys.exit(0)
    if yaml_file == "-i":
        parse_customer_info_interactive()
    else:
        parse_customer_info(yaml_file)
    # token_log = "cloudian-token.log"
    # parse_token_log(yaml_file, token_log)
